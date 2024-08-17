import styled from "styled-components";

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
  return (
    <StyledInput
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type="text"
      value={value}
    />
  );
}

const StyledInput = styled.input`

`;
