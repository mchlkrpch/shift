import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
import random
from collections import deque

class StudentSimEnv:
    def __init__(self, gkt_model, num_tasks, hidden_dim):
        self.model = gkt_model
        self.num_tasks = num_tasks
        self.hidden_dim = hidden_dim
        self.state = None
        self.device = gkt_model.device
        self.reset()

    def reset(self):
        self.state = torch.zeros(1, self.num_tasks, self.hidden_dim).to(self.device)
        return self.state

    def _get_mastery(self, state):
        with torch.no_grad():
            logits = self.model.predict_layer(state) # [1, N, 1]
            probs = torch.sigmoid(logits)
            return probs.sum().item()

    def step(self, action_task_id):
        """
        action_task_id: int (0-26) - какую задачу решаем
        """
        prev_mastery = self._get_mastery(self.state)
        with torch.no_grad():
            curr_logits = self.model.predict_layer(self.state) # [1, N, 1]
            prob_success = torch.sigmoid(curr_logits[0, action_task_id, 0]).item()
        is_correct = 1 if random.random() < prob_success else 0

        task_tensor = torch.tensor([[action_task_id]], device=self.device)
        status_tensor = torch.tensor([[is_correct]], device=self.device)
        _, next_state = self.model(task_tensor, status_tensor, self.state)
        new_mastery = self._get_mastery(next_state)
        reward = new_mastery - prev_mastery

        self.state = next_state
        done = False
        return next_state, reward, done, {}

class DQNAgent(nn.Module):
    def __init__(self, num_tasks, hidden_dim_gkt):
        super(DQNAgent, self).__init__()
        input_dim = num_tasks * hidden_dim_gkt

        self.fc1 = nn.Linear(input_dim, 256)
        self.fc2 = nn.Linear(256, 128)
        self.out = nn.Linear(128, num_tasks)

    def forward(self, x):
        batch_size = x.size(0)
        x = x.view(batch_size, -1)
        x = torch.relu(self.fc1(x))
        x = torch.relu(self.fc2(x))
        return self.out(x)

class ReplayBuffer:
    def __init__(self, capacity):
        self.buffer = deque(maxlen=capacity)

    def push(self, state, action, reward, next_state, done):
        self.buffer.append((state, action, reward, next_state, done))

    def sample(self, batch_size):
        batch = random.sample(self.buffer, batch_size)
        state, action, reward, next_state, done = zip(*batch)
        return state, action, reward, next_state, done

def train_dqn(gkt_model, num_episodes=180, max_steps=20):
    device = gkt_model.device
    num_tasks = gkt_model.num_tasks
    hidden_dim = gkt_model.hidden_dim

    gkt_model.eval()
    for param in gkt_model.parameters():
        param.requires_grad = False

    env = StudentSimEnv(gkt_model, num_tasks, hidden_dim)

    policy_net = DQNAgent(num_tasks, hidden_dim).to(device)
    target_net = DQNAgent(num_tasks, hidden_dim).to(device)
    target_net.load_state_dict(policy_net.state_dict())
    target_net.eval()

    optimizer = optim.Adam(policy_net.parameters(), lr=1e-4)
    buffer = ReplayBuffer(capacity=10000)

    epsilon = 1.0
    epsilon_decay = 0.995
    epsilon_min = 0.05
    gamma = 0.99
    batch_size = 32

    for episode in range(num_episodes):
        state = env.reset()
        total_reward = 0

        for step in range(max_steps):
            if random.random() < epsilon:
                action = random.randint(0, num_tasks - 1)
            else:
                with torch.no_grad():
                    q_values = policy_net(state)
                    action = q_values.argmax().item()
            next_state, reward, done, _ = env.step(action)
            total_reward += reward

            buffer.push(state, action, reward, next_state, done)
            state = next_state
            if len(buffer.buffer) > batch_size:
                states, actions, rewards, next_states, dones = buffer.sample(batch_size)
                states_b = torch.cat(states).to(device)
                next_states_b = torch.cat(next_states).to(device)
                actions_b = torch.tensor(actions).to(device).unsqueeze(1)
                rewards_b = torch.tensor(rewards).to(device).unsqueeze(1)
                q_vals = policy_net(states_b).gather(1, actions_b)
                with torch.no_grad():
                    next_q_vals = target_net(next_states_b).max(1)[0].unsqueeze(1)
                    expected_q_vals = rewards_b + gamma * next_q_vals

                loss = nn.MSELoss()(q_vals, expected_q_vals)
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

        if epsilon > epsilon_min:
            epsilon *= epsilon_decay

        if episode % 50 == 0:
            target_net.load_state_dict(policy_net.state_dict())
            print(f"Episode {episode}, Total Reward: {total_reward:.4f}, Epsilon: {epsilon:.2f}")
    return policy_net

def get_student_hidden_state(user_id, df, gkt_model, device='cpu'):
    gkt_model.eval()
    if user_id not in user_hist:
        return torch.zeros(1, gkt_model.num_tasks, gkt_model.hidden_dim).to(device)

    user_df = user_hist[user_id].copy()
    user_df = user_df.dropna(subset=['number'])

    if len(user_df) == 0:
        return torch.zeros(1, gkt_model.num_tasks, gkt_model.hidden_dim).to(device)

    task_idxs = (user_df['number'].astype(int) - 1).values
    status_idxs = user_df['status'].map(STATUS_MAP).fillna(0).astype(int).values

    tasks_tensor = torch.tensor(task_idxs, dtype=torch.long).unsqueeze(0).to(device)
    statuses_tensor = torch.tensor(status_idxs, dtype=torch.long).unsqueeze(0).to(device)

    with torch.no_grad():
        _, final_hidden_state = gkt_model(tasks_tensor, statuses_tensor)
    return final_hidden_state

def recommend_sequence_rl(user_id, df, gkt_model, policy_net, steps=5, device='cpu'):
    gkt_model.eval()
    policy_net.eval()
    current_state = get_student_hidden_state(user_id, df, gkt_model, device)
    recommendations = []
    print(f"--- RL traj: {user_id[:8]} ---")

    for step in range(steps):
        with torch.no_grad():
            q_values = policy_net(current_state)
            best_action = q_values.argmax().item()
            best_q = q_values.max().item()

        with torch.no_grad():
            logits = gkt_model.predict_layer(current_state)
            prob_success = torch.sigmoid(logits[0, best_action, 0]).item()
            current_mastery = torch.sigmoid(logits).sum().item()

        simulated_status = 1 if prob_success > 0.5 else 0
        status_str = "true" if simulated_status == 1 else "false"
        rec_info = {
            'step': step + 1,
            'task_number': best_action + 1,
            'predicted_prob': prob_success,
            'agent_confidence': best_q,
            'expected_mastery': current_mastery
        }
        recommendations.append(rec_info)
        task_t = torch.tensor([[best_action]], device=device)
        status_t = torch.tensor([[simulated_status]], device=device)
        with torch.no_grad():
            _, next_state = gkt_model(task_t, status_t, current_state)
        current_state = next_state
    return pd.DataFrame(recommendations)