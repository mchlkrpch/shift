import { Clipboard, IconButton } from "@chakra-ui/react";
import { LuCopy } from "react-icons/lu";

export function Clip({
  value,
  props,
  copyIcon=<LuCopy style={{width:'13px',height:'13px'}}/>
}:any) {
  return (
    <Clipboard.Root value={value} p={0} w={props.width||'fit-content'} display={'flex'}>
      <Clipboard.Trigger asChild>
        <IconButton
          {...props}
          size={undefined}
          onClick={async (e:any)=>{
            e.stopPropagation();
            e.preventDefault();
            await navigator.clipboard.writeText(value);
          }}
        >
          <Clipboard.Indicator>
            {copyIcon}
          </Clipboard.Indicator>
        </IconButton>
      </Clipboard.Trigger>
    </Clipboard.Root>
  );
}