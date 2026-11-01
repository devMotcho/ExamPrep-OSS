export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface UserFormData {
  name: string;
  email: string;
  phone: string;
  role: string;
  active: boolean;
  password: string;
}

export interface UserFormErrors {
  name?: string;
  email?: string;
  password?: string;
}

export const EMPTY_FORM: UserFormData = {
  name: '', email: '', phone: '', role: 'USER', active: true, password: '',
};
