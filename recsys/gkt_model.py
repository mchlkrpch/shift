import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np

class GKT(nn.Module):
    def __init__(self, num_tasks, hidden_dim, adj_matrix, device='cpu'):
        super(GKT, self).__init__()
        self.num_tasks = num_tasks
        self.hidden_dim = hidden_dim
        self.device = device

        adj = torch.tensor(adj_matrix, dtype=torch.float32)
        adj = adj + torch.eye(num_tasks)
        row_sum = adj.sum(dim=1, keepdim=True)
        row_sum[row_sum == 0] = 1
        self.adj = (adj / row_sum).to(device)

        self.interaction_emb = nn.Embedding(num_tasks * 3, hidden_dim)
        self.gru_cell = nn.GRUCell(input_size=hidden_dim * 2, hidden_size=hidden_dim)
        self.neighbor_update = nn.Linear(hidden_dim, hidden_dim)

        self.predict_layer = nn.Linear(hidden_dim, 1)

    def forward(self, task_seq, status_seq, hidden_states=None):
        """
        task_seq: [batch_size, seq_len] (номера заданий 0-26)
        status_seq: [batch_size, seq_len] (статусы 0-2)
        hidden_states: [batch_size, num_tasks, hidden_dim] (начальное состояние)
        """
        batch_size, seq_len = task_seq.shape

        if hidden_states is None:
            hidden_states = torch.zeros(batch_size, self.num_tasks, self.hidden_dim).to(self.device)
        outputs = []
        for t in range(seq_len):
            curr_task = task_seq[:, t]   # [batch]
            curr_status = status_seq[:, t] # [batch]

            input_indices = curr_task * 3 + curr_status
            input_emb = self.interaction_emb(input_indices) # [batch, hidden]

            agg_states = torch.matmul(self.adj, hidden_states)

            batch_indices = torch.arange(batch_size).to(self.device)
            curr_agg = agg_states[batch_indices, curr_task] # [batch, hidden]

            gru_input = torch.cat([input_emb, curr_agg], dim=1) # [batch, hidden*2]
            prev_target_h = hidden_states[batch_indices, curr_task]
            new_target_h = self.gru_cell(gru_input, prev_target_h) # [batch, hidden]
            next_hidden_states = hidden_states.clone()
            next_hidden_states[batch_indices, curr_task] = new_target_h
            hidden_states = next_hidden_states
            logits = self.predict_layer(hidden_states)
            outputs.append(logits.squeeze(-1))
        return torch.stack(outputs, dim=1), hidden_states

def get_ege_adjacency_matrix():
    num_tasks = 27
    adj = np.zeros((num_tasks, num_tasks), dtype=np.float32)
    edges = [
        (4, 8), (8, 14), (4, 11), (11, 7),

        (5, 6), (6, 12),

        (5, 19), (5, 20), (5, 21),
        (19, 23), (20, 23), (21, 23),
        (19, 20), (20, 21), (19, 21),

        (5, 16), (16, 18),

        (3, 9), (9, 17), (17, 18), (18, 22), (22, 26),

        (1, 15), (2, 15), (15, 25), (17, 25), (1, 13), (2, 13),

        (26, 27)
    ]
    for u, v in edges:
        idx_u = u - 1
        idx_v = v - 1

        adj[idx_u][idx_v] = 1
        adj[idx_v][idx_u] = 1
    return adj

def get_stats(
    x: pd.DataFrame,
) -> pd.DataFrame:
    stats = x.groupby(['number', 'status']).size().unstack(fill_value=0)
    if 'CORRECT' not in stats.columns:
        stats['CORRECT'] = 0
    if 'INCORRECT' not in stats.columns:
        stats['INCORRECT'] = 1
    stats['ACCURACY']=stats['CORRECT']/(stats['CORRECT']+stats['INCORRECT'])
    return stats


import torch
from torch.utils.data import Dataset, DataLoader
import torch.nn as nn
import pandas as pd
import numpy as np

STATUS_MAP = {
    'INCORRECT': 0,
    'PARTIALLY_CORRECT': 1,
    'CORRECT': 2
}

class EGEDataset(Dataset):
    def __init__(self, df: pd.DataFrame, max_len=100, min_len=15, min_unique=5):
        self.samples = []
        clean_df = df.dropna(subset=['number', 'status']).copy()
        clean_df['task_idx'] = clean_df['number'].astype(int) - 1
        clean_df['status_idx'] = clean_df['status'].map(STATUS_MAP).fillna(0).astype(int)
        grouped = clean_df.groupby('user_id')
        for user_id, group in grouped:
            if len(group) < min_len:
                continue
            if group['task_idx'].nunique() < min_unique:
                continue
            tasks = group['task_idx'].values
            statuses = group['status_idx'].values
            num_chunks = int(np.ceil(len(tasks) / max_len))
            for i in range(num_chunks):
                start = i * max_len
                end = start + max_len
                chunk_tasks = tasks[start:end]
                chunk_statuses = statuses[start:end]
                if len(chunk_tasks) < 5:
                    continue
                labels = (chunk_statuses == 2).astype(int)
                self.samples.append({
                    'tasks': torch.tensor(chunk_tasks, dtype=torch.long),
                    'statuses': torch.tensor(chunk_statuses, dtype=torch.long),
                    'labels': torch.tensor(labels, dtype=torch.float32)
                })

        print(f"n samples: {len(self.samples)}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        return self.samples[idx]

def collate_fn(batch):
    tasks = [item['tasks'] for item in batch]
    statuses = [item['statuses'] for item in batch]
    labels = [item['labels'] for item in batch]
    tasks_pad = nn.utils.rnn.pad_sequence(tasks, batch_first=True, padding_value=0)
    statuses_pad = nn.utils.rnn.pad_sequence(statuses, batch_first=True, padding_value=2)
    labels_pad = nn.utils.rnn.pad_sequence(labels, batch_first=True, padding_value=-1)

    return tasks_pad, statuses_pad, labels_pad

from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, accuracy_score

def train_gkt(full_df, adj_matrix_np):
    DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
    NUM_TASKS = 27
    HIDDEN_DIM = 64
    BATCH_SIZE = 32
    LR = 0.005
    EPOCHS = 15

    print(f"Device: {DEVICE}")
    full_dataset = EGEDataset(full_df, max_len=100, min_len=15)
    train_data, val_data = train_test_split(full_dataset, test_size=0.2, random_state=42)

    train_loader = DataLoader(train_data, batch_size=BATCH_SIZE, shuffle=True, collate_fn=collate_fn)
    val_loader = DataLoader(val_data, batch_size=BATCH_SIZE, shuffle=False, collate_fn=collate_fn)
    print(f"Train samples: {len(train_data)}, Val samples: {len(val_data)}")

    model = GKT(NUM_TASKS, HIDDEN_DIM, adj_matrix_np, device=DEVICE).to(DEVICE)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    criterion = nn.BCEWithLogitsLoss(reduction='none')

    # --- 3. Цикл обучения ---
    for epoch in range(EPOCHS):
        model.train()
        total_loss = 0

        for tasks, statuses, labels in train_loader:
            tasks, statuses, labels = tasks.to(DEVICE), statuses.to(DEVICE), labels.to(DEVICE)

            optimizer.zero_grad()
            predictions, _ = model(tasks, statuses)
            gather_index = tasks.unsqueeze(-1)
            selected_logits = predictions.gather(2, gather_index).squeeze(-1)

            preds_shifted = selected_logits[:, :-1]
            labels_shifted = labels[:, 1:]

            mask = (labels_shifted != -1)

            loss = criterion(preds_shifted, labels_shifted)
            loss = (loss * mask).sum() / mask.sum()

            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        avg_train_loss = total_loss / len(train_loader)
        model.eval()
        val_loss = 0
        all_preds = []
        all_labels = []

        with torch.no_grad():
            for tasks, statuses, labels in val_loader:
                tasks, statuses, labels = tasks.to(DEVICE), statuses.to(DEVICE), labels.to(DEVICE)

                predictions, _ = model(tasks, statuses)
                gather_index = tasks.unsqueeze(-1)
                selected_logits = predictions.gather(2, gather_index).squeeze(-1)

                preds_shifted = selected_logits[:, :-1]
                labels_shifted = labels[:, 1:]
                mask = (labels_shifted != -1)

                loss = criterion(preds_shifted, labels_shifted)
                val_loss += (loss * mask).sum() / mask.sum()
                probs = torch.sigmoid(preds_shifted)

                valid_probs = probs[mask].cpu().numpy()
                valid_labels = labels_shifted[mask].cpu().numpy()

                all_preds.extend(valid_probs)
                all_labels.extend(valid_labels)
        val_auc = roc_auc_score(all_labels, all_preds) if len(all_labels) > 0 else 0
        val_acc = accuracy_score(all_labels, [1 if p > 0.5 else 0 for p in all_preds])

        print(f"Epoch {epoch+1:02d} | "
              f"Train Loss: {avg_train_loss:.4f} | "
              f"Val Loss: {val_loss/len(val_loader):.4f} | "
              f"Val AUC: {val_auc:.4f} | "
              f"Val Acc: {val_acc:.4f}")
    torch.save(model.state_dict(), "gkt_ege_model.pth")
    print("Модель сохранена в gkt_ege_model.pth")
    return model

import torch
import numpy as np
import pandas as pd

STATUS_MAP = {'INCORRECT': 0, 'PARTIALLY_CORRECT': 1, 'CORRECT': 2}

def get_user_state(user_id, df, model, device='cpu'):
    model.eval()
    user_df = user_hist[user_id].copy()
    print(get_stats(user_df))
    if user_df['number'].isna().any():
        user_df = user_df.dropna(subset=['number'])
    if len(user_df) == 0:
        print("undef user")
        return torch.full((27,), 0.5)
    task_idxs = (user_df['number'].astype(int) - 1).values
    status_idxs = user_df['status'].map(STATUS_MAP).fillna(0).astype(int).values

    tasks_tensor = torch.tensor(task_idxs, dtype=torch.long).unsqueeze(0).to(device)     # [1, seq_len]
    statuses_tensor = torch.tensor(status_idxs, dtype=torch.long).unsqueeze(0).to(device) # [1, seq_len]

    with torch.no_grad():
        predictions, _ = model(tasks_tensor, statuses_tensor)
    last_step_logits = predictions[0, -1, :] # [27]
    probabilities = torch.sigmoid(last_step_logits).cpu().numpy()
    return probabilities

def recommend_next_task(user_id, full_df, model, adj_matrix, device='cuda'):
    probs = get_user_state(user_id, full_df, model, device)
    report = pd.DataFrame({
        'task_number': np.arange(1, 28), # 1..27
        'prob_success': probs,
        'task_idx': np.arange(0, 27)
    })

    centrality = adj_matrix.sum(axis=0)
    report['criticality'] = centrality
    report['foundation_score'] = report['criticality'] * (1.0 - report['prob_success'])

    foundation_task = report.sort_values('foundation_score', ascending=False).iloc[0]
    growth_zone = report[
        (report['prob_success'] >= 0.4) &
        (report['prob_success'] <= 0.75)
    ]

    if len(growth_zone) == 0:
        growth_task = report[report['prob_success'] > 0.3].sort_values('prob_success').iloc[0]
    else:
        growth_task = growth_zone.sort_values('criticality', ascending=False).iloc[0]

    confidence_task = report[report['prob_success'] > 0.85].sort_values('prob_success', ascending=False)
    if len(confidence_task) > 0:
        confidence_task = confidence_task.iloc[0]
    else:
        confidence_task = None
    print(f"=== for user {user_id[:8]}... ===")

    print(f"\nbase: №{int(foundation_task['task_number'])}")
    print(f"root node, low P(success) {foundation_task['prob_success']:.1%}.")

    print(f"\n new: №{int(growth_task['task_number'])}")
    print(f"P: {growth_task['prob_success']:.1%} - noraml rate")

    if confidence_task is not None:
        print(f"\neasy for you: №{int(confidence_task['task_number'])} ({confidence_task['prob_success']:.1%})")

    return report