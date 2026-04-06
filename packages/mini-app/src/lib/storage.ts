function getCloudStorage(): any {
  return (window as any).Telegram?.WebApp?.CloudStorage;
}

function wrap(fn: (resolve: (v: any) => void, reject: (e: any) => void) => void): Promise<any> {
  return new Promise(fn);
}

export async function saveEncryptedKey(encryptedHex: string): Promise<void> {
  const cs = getCloudStorage();
  if (cs) {
    return wrap((resolve, reject) =>
      cs.setItem("encrypted_pk", encryptedHex, (err: any) => err ? reject(err) : resolve(undefined))
    );
  }
  localStorage.setItem("starkzap_encrypted_pk", encryptedHex);
}

export async function loadEncryptedKey(): Promise<string | null> {
  const cs = getCloudStorage();
  if (cs) {
    return wrap((resolve, reject) =>
      cs.getItem("encrypted_pk", (err: any, val: string) => err ? reject(err) : resolve(val || null))
    );
  }
  return localStorage.getItem("starkzap_encrypted_pk");
}

export async function hasWallet(): Promise<boolean> {
  const key = await loadEncryptedKey();
  return !!key && key.length > 0;
}

export async function saveWalletAddress(address: string): Promise<void> {
  const cs = getCloudStorage();
  if (cs) {
    return wrap((resolve, reject) =>
      cs.setItem("wallet_address", address, (err: any) => err ? reject(err) : resolve(undefined))
    );
  }
  localStorage.setItem("starkzap_wallet_address", address);
}

export async function loadWalletAddress(): Promise<string | null> {
  const cs = getCloudStorage();
  if (cs) {
    return wrap((resolve, reject) =>
      cs.getItem("wallet_address", (err: any, val: string) => err ? reject(err) : resolve(val || null))
    );
  }
  return localStorage.getItem("starkzap_wallet_address");
}

export async function clearWallet(): Promise<void> {
  const cs = getCloudStorage();
  if (cs) {
    await wrap((resolve, reject) => cs.removeItem("encrypted_pk", (err: any) => err ? reject(err) : resolve(undefined)));
    await wrap((resolve, reject) => cs.removeItem("wallet_address", (err: any) => err ? reject(err) : resolve(undefined)));
    return;
  }
  localStorage.removeItem("starkzap_encrypted_pk");
  localStorage.removeItem("starkzap_wallet_address");
}
