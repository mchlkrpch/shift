import { Clipboard, IconButton } from "@chakra-ui/react";

export function Clip({value, props}:any) {
  return (
    <Clipboard.Root value={value}>
      <Clipboard.Trigger asChild>
        <IconButton
          {...props}
          onClick={async (e:any)=>{
            e.stopPropagation();
            e.preventDefault();
            await navigator.clipboard.writeText(value);
          }}
        >
          <Clipboard.Indicator/>
        </IconButton>
      </Clipboard.Trigger>
    </Clipboard.Root>
  );
}