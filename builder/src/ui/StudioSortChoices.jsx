import { STUDIO_SORT_OPTIONS } from "../source-add/index.js";
import { SemanticSortChoices, SourceCreationSortChoices } from "./SemanticSortChoices.jsx";

export function StudioSortChoices({
	selectedId,
	selectedIds,
	name,
	firstInputRef = null,
	onChange,
	legend = "Sort titles by",
}) {
	if (Array.isArray(selectedIds)) return <SourceCreationSortChoices options={STUDIO_SORT_OPTIONS} selectedIds={selectedIds} name={name} firstInputRef={firstInputRef} onChange={onChange} />;
	return (
		<SemanticSortChoices options={STUDIO_SORT_OPTIONS} selectedId={selectedId} name={name} firstInputRef={firstInputRef} onChange={onChange} legend={legend} />
	);
}
