import classNames from "classnames";
import { type PropsWithChildren } from "react";

interface ModalProps {
  onRequestClose: () => void;
  open: boolean;
}

export default function Modal({
  children,
  onRequestClose,
  open,
}: PropsWithChildren<ModalProps>) {
  return (
    <>
      {open && (
        <div
          className={classNames(
            "bg-black/25",
            "fixed",
            "h-screen",
            "items-center",
            "justify-center",
            "left-0",
            "top-0",
            "w-screen",
            "z-50",
            {
              flex: open,
              "display-none": !open,
            },
          )}
          onClick={() => onRequestClose()}
        >
          <div
            className="
            bg-white
            rounded
            p-2
            "
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </div>
      )}
    </>
  );
}
