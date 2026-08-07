import { api } from "./client";

/**
 * List own bank accounts (GET /staff/me/bank-accounts)
 */
export async function getBankAccountsApi() {
  return await api.GET("/staff/me/bank-accounts");
}

/**
 * Add bank account (POST /staff/me/bank-accounts)
 */
export async function addBankAccountApi(data: {
  name: string;
  number: string;
  provider: string;
}) {
  return await api.POST("/staff/me/bank-accounts", {
    body: data,
  });
}
