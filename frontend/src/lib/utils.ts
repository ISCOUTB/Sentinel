import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const generateUsername = (
  name: string,
  lastName: string,
  phone: string
): string => {
  const cleanName = name.trim().toLowerCase();
  const cleanLastName = lastName.trim().toLowerCase();
  const cleanPhone = phone.replace(/\D/g, "");

  const firstLetter = cleanName.charAt(0);
  const lastTwoDigits = cleanPhone.slice(-2);

  return `${firstLetter}${cleanLastName}${lastTwoDigits}`;
};
