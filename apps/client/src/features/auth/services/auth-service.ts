import api from "@/lib/api-client";
import {
  IChangePassword,
  ICollabToken,
  IForgotPassword,
  ILogin,
  ILoginResponse,
  IPasswordReset,
  ISetupWorkspace,
  IVerifyUserToken,
} from "@/features/auth/types/auth.types";
import { IWorkspace } from "@/features/workspace/types/workspace.types.ts";

export async function login(data: ILogin): Promise<ILoginResponse> {
  const response = await api.post<ILoginResponse>("/auth/login", data);
  return response.data;
}

export async function logout(): Promise<void> {
  await api.post<void>("/auth/logout");
}

export async function changePassword(
  data: IChangePassword,
): Promise<IChangePassword> {
  const req = await api.post<IChangePassword>("/auth/change-password", data);
  return req.data;
}

export async function setupWorkspace(
  data: ISetupWorkspace,
): Promise<IWorkspace> {
  const req = await api.post<IWorkspace>("/auth/setup", data);
  return req.data;
}

export async function forgotPassword(data: IForgotPassword): Promise<void> {
  await api.post<void>("/auth/forgot-password", data);
}

export async function passwordReset(data: IPasswordReset): Promise<{ requiresLogin?: boolean; }> {
  const req = await api.post("/auth/password-reset", data);
  return req.data;
}

export const verifyUserToken = async (data: IVerifyUserToken) => {
  const response = await api.post("/auth/verify-token", data);

  return response.data;
};

export const verifyMfa = async (data: ILogin & { token: string }) => {
  const response = await api.post("/auth/mfa/verify", data);
  return response.data;
};

export const generateMfaSecret = async () => {
  const response = await api.post("/auth/mfa/generate");
  return response.data;
};

export const enableMfa = async (data: { secret: string; token: string }) => {
  const response = await api.post("/auth/mfa/enable", data);
  return response.data;
};

export const disableMfa = async () => {
  const response = await api.post("/auth/mfa/disable");
  return response.data;
};

export const setupGenerateMfaSecret = async (data: ILogin) => {
  const response = await api.post("/auth/mfa/setup/generate", data);
  return response.data;
};

export const setupEnableMfa = async (data: ILogin & { secret: string; token: string }) => {
  const response = await api.post("/auth/mfa/setup/enable", data);
  return response.data;
};