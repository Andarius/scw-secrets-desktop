const SECRET_MANAGER_REGION = "fr-par";

export function secretConsoleUrl(secretId: string): string {
	return `https://console.scaleway.com/secret-manager/secrets/${SECRET_MANAGER_REGION}/${secretId}/overview`;
}
