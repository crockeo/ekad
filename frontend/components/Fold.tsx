import classNames from "classnames";
import { type PropsWithChildren, useState } from "react";

interface FoldProps {
  name: string;
}

export default function Fold({ children, name }: PropsWithChildren<FoldProps>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className="
        cursor-pointer
        select-none
        italic
        text-sm
        "
        onClick={() => setOpen(!open)}
      >
        {open ? "▽" : "▷"} {name}
      </div>
      <div
        className={classNames({
          hidden: !open,
        })}
      >
        {children}
      </div>
    </>
  );
}
