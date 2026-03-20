import { forwardRef } from "react";
import { useGraphCtx } from "../../App";
import { Card, useCardCtx } from "./card";

export const Cell: any = forwardRef((
    {id}:any,ref:any,
)=>{
    const {
        ns,
    }=useGraphCtx() as any;
    const {
        path,setPath,
        setC,
    }=useCardCtx()as any;
    return (
        <span className='inlineCell'
            id={id}
            contentEditable={false}
            onClick={(e:any)=>{
                setPath([...path,id])
                setC(ns[id])
                e.stopPropagation();
            }}
        >
            <Card
                ref={ref}
                id={id}
                content={ns[id]}
                tp={'embed'}
            />
        </span>
    )
});