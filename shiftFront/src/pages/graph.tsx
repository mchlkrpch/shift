import { useEffect, useRef, useState } from 'react';
import { Header } from "../components/header";
import { Spinner, Box, Text } from '@chakra-ui/react';
import { gReq } from '../appwrite/service'; 
import { GraphCtx } from '../App';
import { Graph } from '../sh/graph/graph';
import { History } from './utils';
import { Sh } from '../sh/card/utility';
// import store from '../storage';
// 69e538c100181b0740ad


const cntStr=`first
@@@
second<id=2>third<id=2>fourth
\`\`\`python
import typing;
def add_numbers(a, b)->typng.Any:
	"""Function to return the sum of two numbers."""
	return a + b
\`\`\`
this code provide strong power of wibe coding
===
second
@@@
segssges sgds
`;


const inner2:string=`inner
@@@
inner complex definition of something <id=3>`;


const inner3:string=`inner second def
@@@
more simple definition`;


const inner4:string=`Аффинные многообразия
@@@
Пусть k — алгебраически замкнутое поле (в классической алгебраической геометрии
— поле комплексных чисел);
$\{\\displaystyle \\mathbb \{A\}^\{n\}\}$ — n-мерное аффинное пространство над k.
Существует теорема из классического анализа, утверждающая, что замкнутые подмножества

$\{\\displaystyle \\mathbb {R} ^{n}} — это в точности множества нулей всевозможных
бесконечно дифференцируемых функций.[4] Топология Зарисского в некотором смысле
переносит это свойство на случай полиномиальных функций: при определении топологии
Зарисского каждому множеству многочленов от n переменных сопоставляется множество точек
аффинного пространства, на которых все эти многочлены равны нулю:

\$\{\\displaystyle Z(S)=\\{x\\in \\mathbb {A}^{n}\\mid f(x)=0\;\\forall f\\in S\\}}$
Замкнутые множества в топологии Зарисского на 
\{\\displaystyle \\mathbb {A}^{n}}$
— это все множества вида Z(S), также эти замкнутые множества называются
алгебраическими множествами. Аффинное алгебраическое многообразие
— это алгебраическое множество, которое нельзя представить в виде объединения
двух меньших алгебраических множеств
`;

const ns: object={
  '1': cntStr,
  '2': inner2,
  '3': inner3,
  '4':inner4,
};

export const GraphPage = ({mode,id,name}: any) => {
    const [_,setGraphData] = useState<any>(null);
    const [loading,setLoading] = useState<boolean>(true);
    const [error,setError] = useState<string | null>(null);
    const [curNs,setNs] = useState({}) as any;
    const [nm,setName]=useState(name) as any;
    const gRef=useRef(null)as any;
    const headerRef=useRef(null) as any;
    useEffect(() => {
        const fetchGraphData = async()=>{
            if (mode === 'brief') {
                try {
                    const data = await gReq.read(id) as any;
                    console.log('get data:',data)
                    // name=data.name;
                    if (data) {
                        setName(data.name)
                        setGraphData(data);
                        setNs(JSON.parse(data.content))
                    } else {
                        setError("no such graph");
                    }
                } catch (err) {
                    setError("err");
                } finally {
                    setLoading(false);
                }
            } else {
                try {
                    const pathParts = window.location.pathname.split('/');
                    id = pathParts[pathParts.length-1]||pathParts[1];
                    const data = await gReq.read(id) as any;
                    console.log('get data:',data)
                    if (data) {
                        setName(data.name)
                        setGraphData(data);
                        setNs(JSON.parse(data.content))
                    } else {
                        setError("no such graph");
                    }
                } catch (err) {
                    setError("err");
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchGraphData();
    },[]);
    if (mode==='brief') {
        return <Box w={'100%'} onClick={()=>{
            History.push(`/${id}`)
        }}>
            <Sh value={name}/>
        </Box>
    }
    if (mode==='page'){
        return (
            <Box display="flex" flexDirection="column" h="100vh">
                <Header ref={headerRef}/>
                <Box flex={1} minH={0} p={0} m={0} display="flex" flexDirection="column" alignItems="center">
                    {loading ? (
                        <Spinner size="xl" mt={10} />
                    ) : error ? (
                        <Text color="red.500" mt={10}>{error}</Text>
                    ) : (
                        <GraphCtx.Provider value={{
                        ns: curNs, setNs: setNs,
                        ref: gRef,
                        id: window.location.pathname.split('/')[1],
                        name: nm,
                        }}>
                            <Graph ref={gRef} headerRef={headerRef}/>
                        </GraphCtx.Provider>
                    )}
                </Box>
            </Box>
        );
    }
    return <>g</>
}