import classNames from "classnames";
import type { MouseEventHandler, PropsWithChildren } from "react";

type ButtonType = "primary" | "secondary" | "constructive" | "destructive";

interface ButtonProps {
  disabled?: boolean;
  idleBorder?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type: ButtonType;
}

export default function Button({
  children,
  disabled,
  onClick,
  type,
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      className={classNames(
        "border",
        "border-transparent",
        "font-bold",
        "group",
        "rounded",
        "transition",
        {
          "text-gray-300": disabled,
          "cursor-pointer": !disabled,
          ...buttonTypeStyle(),
        },
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );

  function buttonTypeStyle() {
    // TODO: style secondary type
    return {
      primary: {
        "text-blue-500": true,
        "hover:bg-blue-100": !disabled,
        "active:bg-blue-200": !disabled,
        "active:border-blue-500": !disabled,
      },
      secondary: {
        "text-gray-500": true,
        "hover:bg-gray-100": !disabled,
        "active:bg-gray-200": !disabled,
        "active:border-gray-500": !disabled,
      },
      constructive: {
        "text-emerald-500": true,
        "hover:bg-emerald-100": !disabled,
        "active:bg-emerald-200": !disabled,
        "active:border-emerald-500": !disabled,
      },
      destructive: {
        "text-red-500": true,
        "hover:bg-red-100": !disabled,
        "active:bg-red-200": !disabled,
        "active:border-red-500": !disabled,
      },
    }[type];
  }
}
