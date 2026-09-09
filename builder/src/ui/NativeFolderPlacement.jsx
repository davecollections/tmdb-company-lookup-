import { useEffect, useState } from "react";
import { reconcileNativeFolderDestinations, resolveNativeHierarchyPlacements, nativeHierarchyCounts } from "../source-add/native-source-variants.js";
import { isInvisibleNuvioTitle } from "../nuvio/titles.js";
import { SourceVariantCounts } from "./SourceVariantReview.jsx";

export function useNativeFolderPlacement(destinationId, entries) {
	const [choice, setChoice] = useState({ destinationId, folders: {} });
	const folders = reconcileNativeFolderDestinations(entries, choice.destinationId === destinationId ? choice.folders : {});
	const signature = JSON.stringify(folders);
	useEffect(() => { setChoice((current) => current.destinationId === destinationId && JSON.stringify(current.folders) === signature ? current : { destinationId, folders }); }, [destinationId, signature]);
	const valid = entries.every((entry) => entry.outcome);
	const resolved = valid ? resolveNativeHierarchyPlacements(entries.map((entry) => ({ sources: entry.drafts, outcome: entry.outcome })), destinationId, folders) : null;
	return {
		folderDestinations: folders, outcomes: resolved?.placed.map((entry) => entry.outcome) ?? entries.map((entry) => entry.outcome),
		counts: resolved ? nativeHierarchyCounts([], resolved.folders, resolved.placed, resolved.existingFolderAdditions) : null,
		choose(index, folderInternalId) {
			const id = String(entries[index].id);
			setChoice({ destinationId, folders: { ...folders, [id]: folderInternalId } });
		},
	};
}

export function NativeFolderPlacementSummary({ counts }) {
	if (!counts) return null;
	return <div className="native-folder-placement-summary" id="native-folder-placement-summary" role="status">
		<SourceVariantCounts counts={counts} />
		{counts.existing > 0 ? <p className="native-folder-duplicate-notice">Some sources already exist and won’t be created.</p> : null}
		{counts.unresolvedEntityCount > 0 ? <p>Choose a folder for each entry that needs a destination.</p> : null}
	</div>;
}

export function NativeFolderPlacementNotice({ name, outcome, onChoose }) {
	if (!outcome) return null;
	const existing = outcome.existingSourceCount ?? outcome.sourceOutcomes.filter((source) => source.destination.length > 0).length;
	const missing = outcome.missingSourceCount ?? outcome.identities.length - existing;
	const ambiguous = missing > 0 && outcome.matchingFolders.length > 1;
	return <div className="native-folder-placement-status" data-native-folder-placement={existing === outcome.identities.length ? "complete" : existing > 0 ? "partial" : "new"}>
		<p className="editor-field-help" role="status">{existing > 0 ? <><strong>{missing === 0 ? "Already added" : "Partly added"}</strong>{missing > 0 ? ` · ${missing} new source${missing === 1 ? "" : "s"}` : ""}</> : outcome.matchingFolders.length ? `${missing} source${missing === 1 ? "" : "s"} to add` : "New folder"}</p>
		{ambiguous ? <label className="editor-field native-folder-destination"><span>Add new sources to</span>
			<select aria-label={`Add new sources for ${name} to`} aria-invalid={outcome.kind === "unresolved" ? "true" : undefined} value={outcome.targetFolderInternalId ?? ""} onChange={(event) => onChoose(event.target.value)}>
				<option value="" disabled>Choose a folder</option>
				{outcome.matchingFolders.map((folder) => <option key={folder.folderInternalId} value={folder.folderInternalId}>{isInvisibleNuvioTitle(folder.folderTitle) || !folder.folderTitle.trim() ? "Hidden-title folder" : folder.folderTitle} · Folder {folder.folderPosition}</option>)}
			</select>
		</label> : null}
	</div>;
}
