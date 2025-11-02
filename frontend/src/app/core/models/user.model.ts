export interface User {
  id: number;
  username: string;
  is_admin?: boolean;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}
