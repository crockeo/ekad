import classNames from "classnames";
import type { MouseEventHandler, PropsWithChildren } from "react";

// TODO: create a primary button type, whenevwe we need it
type ButtonType = "secondary" | "constructive" | "destructive";

interface ButtonProps {
  disabled?: boolean;
  idleBorder?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type: ButtonType;
}

export default function Button({
  children,
  disabled,
  idleBorder,
  onClick,
  type,
}: PropsWithChildren<ButtonProps>) {
  if (idleBorder === undefined) {
    idleBorder = true;
  }

  return (
    <button
      className={classNames("border", "group", "rounded", "transition", {
        "border-gray-300": idleBorder && disabled,
        "border-transparent": !idleBorder,
        "text-gray-300": disabled,
        "cursor-pointer": !disabled,
        ...buttonTypeStyle(),
      })}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );

  function buttonTypeStyle() {
    // TODO: style secondary type
    return {
      secondary: {
        "text-gray-500": true,
        "hover:bg-gray-100": !disabled,
        "active:bg-gray-200": !disabled,
        "active:border-gray-500": !disabled,
      },
      constructive: {
        "text-emerald-500": true,
        "border-emerald-200": idleBorder && !disabled,
        "hover:bg-emerald-100": !disabled,
        "active:bg-emerald-200": !disabled,
        "active:border-emerald-500": !disabled,
      },
      destructive: {
        "text-red-500": true,
        "border-red-200": idleBorder && !disabled,
        "hover:bg-red-100": !disabled,
        "active:bg-red-200": !disabled,
        "active:border-red-500": !disabled,
      },
    }[type];
  }
}
