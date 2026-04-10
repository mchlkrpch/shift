import { Clipboard, IconButton } from "@chakra-ui/react";
import { LuCopy } from "react-icons/lu";

export function Clip({value, props}:any) {
  return (
    <Clipboard.Root value={value}>
      <Clipboard.Trigger asChild>
        <IconButton
          {...props}
          size={undefined}
          onClick={async (e:any)=>{
            e.stopPropagation();
            e.preventDefault();
            await navigator.clipboard.writeText(value);
          }}
          // opacity={.3}
        >
          <Clipboard.Indicator>
            <LuCopy
              style={{width: props.iconSz, height: props.iconSz}}
            />
          </Clipboard.Indicator>
        </IconButton>
      </Clipboard.Trigger>
    </Clipboard.Root>
  );
}