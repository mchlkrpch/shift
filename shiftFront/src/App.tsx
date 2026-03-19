import { Box } from "@chakra-ui/react";
import { Card } from "./sh/card/card";
import 'katex/dist/katex.min.css';

const cntStr=`окольцованное пространство
---
$(X,\\mathcal{O}_X)$ - т.п.\n
$\\mathcal{O}_X$ - пучок коммутативных колец\n
===
о.п
===
$(X,\\mathcal{O}_X)$
`

function App() {
  return (
    <>
      <Box
        w={'100%'}
        p={'10px'}
      >
        <Card
          id={'123'}
          content={cntStr}
          tp={'free'}
        />
      </Box>
    </>
  )
}

export default App
