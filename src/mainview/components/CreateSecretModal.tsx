import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

import { electrobun } from "../rpc";

type CreateSecretModalProps = {
	profile?: string;
	projectId?: string;
	pathSuggestions: string[];
	tagSuggestions: string[];
	onClose: () => void;
	onCreated: () => void;
};

const SECRET_TYPES = [
	{ value: "opaque", label: "Opaque" },
	{ value: "key_value", label: "Key/Value" },
	{ value: "basic_credentials", label: "Basic Credentials" },
	{ value: "database_credentials", label: "Database Credentials" },
	{ value: "ssh_key", label: "SSH Key" },
	{ value: "certificate", label: "Certificate" },
] as const;

const TYPE_HINTS: Record<string, string> = {
	opaque: '{"opaque_data":"any-data-can-go-here"}',
	key_value: '{"key":"value","another":"entry"}',
	basic_credentials: '{"username":"your-username","password":"your-password"}',
	database_credentials: '{"engine":"postgresql","username":"your-username","password":"your-password","host":"db.example.internal","dbname":"app","port":"5432"}',
	ssh_key: '{"ssh_private_key":"-----BEGIN OPENSSH PRIVATE KEY-----\\n..."}',
	certificate: "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
};

function normalizePath(path: string): string {
	const trimmed = path.trim();
	if (!trimmed || trimmed === "/") {
		return "/";
	}

	const cleaned = trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
	return cleaned ? `/${cleaned}` : "/";
}

function tryFormatJson(value: string): string | null {
	try {
		return JSON.stringify(JSON.parse(value), null, 2);
	} catch {
		return null;
	}
}

export function CreateSecretModal({
	profile,
	projectId,
	pathSuggestions,
	tagSuggestions,
	onClose,
	onCreated,
}: CreateSecretModalProps) {
	const [path, setPath] = useState("/");
	const [name, setName] = useState("");
	const [type, setType] = useState("opaque");
	const [tags, setTags] = useState<string[]>([]);
	const [tagInput, setTagInput] = useState("");
	const [value, setValue] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const canSave = name.trim().length > 0 && value.trim().length > 0;
	const normalizedPath = normalizePath(path);
	const formattedJson = useMemo(() => tryFormatJson(value), [value]);
	const canFormatJson = formattedJson !== null && formattedJson !== value;

	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
			if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && canSave && !saving) {
				e.preventDefault();
				void handleCreate();
			}
		}

		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [canSave, onClose, saving, name, path, type, value]);

	function addTag(rawTag: string) {
		const tag = rawTag.trim();
		if (!tag) {
			return;
		}

		setTags((current) => (current.includes(tag) ? current : [...current, tag]));
		setTagInput("");
	}

	function removeTag(tag: string) {
		setTags((current) => current.filter((currentTag) => currentTag !== tag));
	}

	async function handleCreate() {
		setSaving(true);
		setError(null);
		try {
			await electrobun.rpc!.request.createSecret({
				name: name.trim(),
				path: normalizedPath,
				type,
				value,
				tags,
				profile,
				projectId,
			});
			onCreated();
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : String(reason));
		} finally {
			setSaving(false);
		}
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
			onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
		>
			<div className="bg-[#141414] border border-white/10 rounded-xl shadow-2xl w-[92%] max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
				<div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
					<div>
						<h3 className="text-sm font-medium text-gray-300">Create Secret</h3>
						<p className="text-xs text-gray-500 mt-0.5">Create the secret container and its first version</p>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => {
								if (formattedJson) {
									setValue(formattedJson);
								}
							}}
							disabled={!canFormatJson || saving}
							className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-300"
						>
							<span>Format JSON</span>
						</button>
						<button
							type="button"
							onClick={() => void handleCreate()}
							disabled={!canSave || saving}
							className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-cyan-500/20 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-cyan-300"
						>
							{saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
							<span>Create secret</span>
						</button>
						<button
							type="button"
							onClick={onClose}
							className="p-1.5 hover:bg-white/10 rounded transition-colors"
						>
							<X className="w-4 h-4 text-gray-400" />
						</button>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto p-5 space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<label className="space-y-2">
							<span className="text-xs text-gray-400 uppercase tracking-wider">Path</span>
							<input
								list="secret-path-suggestions"
								value={path}
								onChange={(e) => setPath(e.target.value)}
								placeholder="/"
								className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-colors font-mono"
							/>
						</label>
						<label className="space-y-2">
							<span className="text-xs text-gray-400 uppercase tracking-wider">Secret</span>
							<input
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="my-secret"
								className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-colors"
							/>
						</label>
					</div>

					<datalist id="secret-path-suggestions">
						{pathSuggestions.map((suggestion) => (
							<option key={suggestion} value={suggestion} />
						))}
					</datalist>

					<label className="space-y-2 block">
						<span className="text-xs text-gray-400 uppercase tracking-wider">Tags</span>
						<div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
							<div className="mb-3 flex flex-wrap gap-2">
								{tags.length > 0 ? (
									tags.map((tag) => (
										<button
											key={tag}
											type="button"
											onClick={() => removeTag(tag)}
											className="inline-flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 text-xs text-cyan-200 hover:bg-cyan-500/25 transition-colors"
										>
											<span>{tag}</span>
											<span className="text-cyan-300">×</span>
										</button>
									))
								) : (
									<span className="text-xs text-gray-500">No tags yet</span>
								)}
							</div>
							<div className="flex gap-2">
								<input
									list="secret-tag-suggestions"
									value={tagInput}
									onChange={(e) => setTagInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === ",") {
											e.preventDefault();
											addTag(tagInput);
										}
									}}
									placeholder="Add a tag"
									className="w-full px-3 py-2.5 bg-black/20 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:bg-white/5 transition-colors"
								/>
								<button
									type="button"
									onClick={() => addTag(tagInput)}
									disabled={tagInput.trim().length === 0}
									className="px-3 py-2.5 text-xs font-medium rounded-lg bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50"
								>
									Add
								</button>
							</div>
						</div>
					</label>

					<datalist id="secret-tag-suggestions">
						{tagSuggestions.map((suggestion) => (
							<option key={suggestion} value={suggestion} />
						))}
					</datalist>

					<label className="space-y-2 block">
						<span className="text-xs text-gray-400 uppercase tracking-wider">Type</span>
						<select
							value={type}
							onChange={(e) => setType(e.target.value)}
							className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-colors"
						>
							{SECRET_TYPES.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>

					<div className="rounded-lg border border-white/10 bg-white/5 p-3">
						<div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Format hint</div>
						<pre className="text-xs text-gray-300 whitespace-pre-wrap break-words font-mono">
							{TYPE_HINTS[type]}
						</pre>
					</div>

					<label className="space-y-2 block">
						<span className="text-xs text-gray-400 uppercase tracking-wider">Initial value</span>
						<textarea
							value={value}
							onChange={(e) => setValue(e.target.value)}
							spellCheck={false}
							placeholder={TYPE_HINTS[type]}
							className="w-full min-h-[280px] bg-white/5 border border-white/10 rounded-lg p-4 text-sm text-cyan-200 font-mono resize-y focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] transition-colors"
						/>
					</label>

					<div className="text-xs text-gray-500">
						Path will be saved as <span className="font-mono text-gray-300">{normalizedPath}</span>. Existing paths and tags are suggested, but you can enter your own. Ctrl+Enter creates the secret.
					</div>
				</div>

				{error ? (
					<div className="mx-5 mb-4 px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
						{error}
					</div>
				) : null}
			</div>
		</div>
	);
}
