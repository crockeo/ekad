import type { ChangeEvent } from "react";

interface TextInputProps {
  placeholder?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  value: string;
}

export default function TextInput({
  placeholder,
  onChange,
  value,
}: TextInputProps) {
  return (
    <input
      className="
      border
      border-gray-200
      grow
      p-2
      rounded
      transition
      focus:border-gray-400
      focus:outline-none
      "
      type="text"
      onChange={onChange}
      placeholder={placeholder}
      value={value}
    />
  );
}
