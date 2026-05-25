export type UserRole = 'ADMIN' | 'USER';

export interface LoginCredentials {
  readonly email: string;
  readonly password: string;
}

export interface UserInfo {
  readonly id: number;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: UserRole;
}

export interface AuthResponse {
  readonly token: string;
  readonly tokenType: string;
  readonly expiresIn: number;
  readonly user: UserInfo;
}
