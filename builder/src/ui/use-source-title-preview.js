import { useEffect, useRef, useState } from "react";
import { createAsyncRequestCoordinator } from "../source-add/async-request-state.js";
import { requestSourceTitlePreview, sourcePreviewContext, sourcePreviewVariantGroups, sourcePreviewVariantKey, sourceTitlePreviewProviderAvailable, sourceTitlePreviewRequest } from "../source-add/source-title-preview.js";
import { focusElementWithoutScroll } from "./hierarchy-menu-placement.js";

// Shared creation Preview lifecycle, extracted from ordinary Add Source.
// The candidate set is a detached view of the complete validated creation set.
export function useSourceTitlePreview(kind, providers) {
	const [preview, setPreview] = useState(null);
	const coordinatorRef = useRef(null);
	const triggerRef = useRef(null);
	if (!coordinatorRef.current) coordinatorRef.current = createAsyncRequestCoordinator();
	useEffect(() => () => coordinatorRef.current.cancel({ notify: false }), []);

	async function load(candidate) {
		setPreview({ status: "loading", candidate, data: null, error: null });
		const outcome = await coordinatorRef.current.run(
			({ signal }) => requestSourceTitlePreview(candidate.request, providers, signal),
			sourcePreviewVariantKey(candidate.sourceDraft),
		);
		if (!outcome.accepted) return;
		if (outcome.result?.ok) setPreview({ status: "ready", candidate, data: outcome.result.data, error: null });
		else if (outcome.result?.error?.kind !== "aborted") setPreview({ status: "error", candidate, data: null, error: outcome.result?.error });
	}

	function candidateFor(drafts, draft, person, label) {
		const request = sourceTitlePreviewRequest(kind, draft, { person });
		return { drafts, sourceDraft: draft, person, label, request: { ...request, ...(label ? { label } : {}) } };
	}

	function available(drafts, person = null) {
		return drafts.length > 0 && drafts.every((draft) => sourcePreviewVariantKey(draft) !== null)
			&& sourceTitlePreviewProviderAvailable(sourceTitlePreviewRequest(kind, drafts[0], { person }), providers);
	}

	function open(drafts, { trigger = null, person = null, label = null } = {}) {
		if (!available(drafts, person)) return;
		triggerRef.current = trigger;
		load(candidateFor(drafts, drafts[0], person, label));
	}

	function close() {
		coordinatorRef.current.cancel({ notify: false });
		setPreview(null);
		const trigger = triggerRef.current;
		triggerRef.current = null;
		window.requestAnimationFrame(() => focusElementWithoutScroll(trigger));
	}

	const selectorGroups = preview ? sourcePreviewVariantGroups(preview.candidate.drafts, preview.candidate.sourceDraft, (draft) => {
		if (sourcePreviewVariantKey(draft) === sourcePreviewVariantKey(preview.candidate.sourceDraft)) return;
		load(candidateFor(preview.candidate.drafts, draft, preview.candidate.person, preview.candidate.label));
	}) : [];
	return {
		preview, available, open, close,
		dialogProps: {
			preview, selectorGroups,
			context: preview ? sourcePreviewContext(preview.candidate.sourceDraft) : null,
			onClose: close,
			onRetry: () => preview && load(preview.candidate),
		},
	};
}
