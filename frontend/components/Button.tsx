import { type PropsWithChildren } from "react";
import styled from "styled-components";

import useTheme, { type Theme } from "../theme";

type ButtonType = "primary" | "secondary" | "constructive" | "destructive";

interface ButtonProps {
  disabled?: boolean;
  type: ButtonType;
}

export default function Button({
  children,
  disabled,
  type,
}: PropsWithChildren<ButtonProps>) {
  const theme = useTheme();
  return (
    <StyledButton
      $disabled={disabled || false}
      $theme={theme}
      $type={type}
      disabled={disabled}
    >
      {children}
    </StyledButton>
  );
}

interface StyledButtonProps {
  $disabled: boolean;
  $theme: Theme;
  $type: ButtonType;
}

const StyledButton = styled.button<StyledButtonProps>`
  background-color: ${({ $theme, $type }) => {
    switch ($type) {
      case "primary":
        return $theme.colors.primary;
      case "secondary":
        return $theme.colors.secondary;
      case "constructive":
        return $theme.colors.constructive;
      case "destructive":
        return $theme.colors.destructive;
    }
  }};
  border-color: ${({ $theme, $type }) => {
    switch ($type) {
      case "primary":
        return $theme.colors.primaryDarker;
      case "secondary":
        return $theme.colors.secondaryDarker;
      case "constructive":
        return $theme.colors.constructiveDarker;
      case "destructive":
        return $theme.colors.destructiveDarker;
    }
  }};
  border-radius: 0.5rem;
  border-style: solid;
  border-width: 1px;
  color: ${({ $theme, $type }) => {
    switch ($type) {
      case "primary":
        return $theme.colors.primaryDarker;
      case "secondary":
        return $theme.colors.secondaryDarker;
      case "constructive":
        return $theme.colors.constructiveDarker;
      case "destructive":
        return $theme.colors.destructiveDarker;
    }
  }};
  opacity: ${({ $disabled }) => ($disabled ? "50%" : "100%")};
  padding: 0.5rem 0.7rem;
`;
