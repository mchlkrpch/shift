export const match: any = (
    v: any,
    p: Object,
)=>{
    for (let i = 0; i < Object.keys(p).length; ++i) {
        if (v === Object.keys(p)[i]) {
            // @ts-expect-error
            return p[Object.keys(p)[i]];
        }
    }
    return undefined;
}