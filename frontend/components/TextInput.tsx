import type { ChangeEvent } from "react";

interface TextInputProps {
  placeholder?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  value: string;
  $ref?: React.RefObject<HTMLInputElement>;
}

export default function TextInput({
  onChange,
  placeholder,
  $ref,
  value,
}: TextInputProps) {
  return (
    <input
      className="
      border
      border-gray-200
      grow
      px-2
      py-1
      rounded
      transition
      focus:border-gray-400
      focus:outline-none
      "
      type="text"
      onChange={onChange}
      placeholder={placeholder}
      ref={$ref}
      value={value}
    />
  );
}
