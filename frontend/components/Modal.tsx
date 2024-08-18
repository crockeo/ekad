import { type PropsWithChildren } from "react";
import styled from "styled-components";

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
        <BackgroundPane onClick={() => onRequestClose()} open={open}>
          <ForegroundPane onClick={(e) => e.preventDefault()}>
            {children}
          </ForegroundPane>
        </BackgroundPane>
      )}
    </>
  );
}

const BackgroundPane = styled.div<{ open: boolean }>`
  align-items: center;
  background-color: rgba(0, 0, 0, 0.1);
  display: ${props => props.open ? "flex" : "none"};
  height: 100%;
  justify-content: center;
  left: 0;
  position: fixed;
  top: 0;
  width: 100%;
  z-index: 1000;
`;

// TODO: make this styled with the theme
const ForegroundPane = styled.div`
  background-color: #ffffff;
  border-radius: 1rem;
  box-shadow: 0px 4px 8px rgb(0, 0, 0, 0.2);
  padding: 1rem;
`;
