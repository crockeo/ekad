import React, {type PropsWithChildren} from "react";

interface ButtonProps {
  disabled?: boolean;
}

export default function Button({
  children,
  disabled,
}: PropsWithChildren<ButtonProps>) {
  return (
    <button disabled={disabled}>
      {children}
    </button>
  )
}
