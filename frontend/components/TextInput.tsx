import styled from "styled-components";
import useTheme from "../theme";

interface TextInputProps {
  placeholder?: string;
  onChange: (newValue: string) => void;
  value: string;
}

export default function TextInput({
  placeholder,
  onChange,
  value,
}: TextInputProps) {
  const theme = useTheme();
  return (
    <StyledInput
      $borderColor={theme.colors.text}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type="text"
      value={value}
    />
  );
}

interface StyledInputProps {
  $borderColor: string;
}

const StyledInput = styled.input<StyledInputProps>`
  border-color: ${({ $borderColor }) => $borderColor};
  border-radius: 0.3rem;
  border-style: solid;
  border-width: 1px;
  padding: 0.5rem 0.7rem;
  &:focus {
    outline: none;
  }
`;
