import { NETWORK_SORT_OPTIONS } from "../source-add/index.js";
import { SemanticSortChoices, SourceCreationSortChoices } from "./SemanticSortChoices.jsx";

export function NetworkSortChoices({
	selectedId,
	selectedIds,
	name,
	firstInputRef = null,
	onChange,
	legend = "Sort titles by",
}) {
	if (Array.isArray(selectedIds)) return <SourceCreationSortChoices options={NETWORK_SORT_OPTIONS} selectedIds={selectedIds} name={name} firstInputRef={firstInputRef} onChange={onChange} helper="Choose one or more options. Each option creates a separate Series source." />;
	return <SemanticSortChoices options={NETWORK_SORT_OPTIONS} selectedId={selectedId} name={name} firstInputRef={firstInputRef} onChange={onChange} legend={legend} />;
}
