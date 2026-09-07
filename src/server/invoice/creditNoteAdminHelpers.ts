import {
  createOrFetchGstCreditNote,
  getCreditNoteByIdOrNumber,
  listGstCreditNotes,
  updateCreditNoteGstReportingStatus
} from "./creditNoteEngine";
import { evaluateCreditNoteEligibility } from "./creditNoteEligibility";
import { streamGstCreditNotePdfResponse } from "./creditNotePdfGenerator";

export async function handleGetCreditNoteEligibility(req: any, res: any, adminDb: any) {
  const returnId = String(req.params.returnId || req.query.returnId || req.query.orderId || "").trim();
  if (!returnId) {
    return res.status(400).json({
      success: false,
      error: "Must specify returnId or orderId to evaluate credit note eligibility."
    });
  }

  try {
    const result = await evaluateCreditNoteEligibility(adminDb, {
      returnRequestId: returnId,
      rmaNumber: returnId,
      orderId: returnId,
      allowOpenReturnOverride: req.query.allowOpenReturnOverride === "true"
    });

    return res.json({
      success: result.eligible,
      eligibility: result
    });
  } catch (err: any) {
    console.error("Error evaluating credit note eligibility:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to evaluate credit note eligibility."
    });
  }
}

export async function handleIssueCreditNote(req: any, res: any, adminDb: any) {
  const body = req.body || {};
  const adminEmail = (req as any).adminUser?.email || "admin@saandsha.com";

  if (!body.orderId && !body.rmaNumber && !body.returnRequestId && !body.invoiceId) {
    return res.status(400).json({
      success: false,
      error: "Must provide orderId, rmaNumber, returnRequestId, or invoiceId to issue a credit note."
    });
  }

  try {
    const result = await createOrFetchGstCreditNote(adminDb, {
      orderId: body.orderId,
      invoiceId: body.invoiceId,
      rmaNumber: body.rmaNumber,
      returnRequestId: body.returnRequestId,
      itemsToCredit: body.itemsToCredit,
      creditShipping: body.creditShipping,
      reason: body.reason,
      reasonDetails: body.reasonDetails,
      createdBy: adminEmail,
      idempotencyKey: body.idempotencyKey,
      allowOpenReturnOverride: body.allowOpenReturnOverride === true
    });

    if (!result.success) {
      const statusCode = result.code === "NO_FINALIZED_INVOICE" ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    return res.json(result);
  } catch (err: any) {
    console.error("Error issuing credit note:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to issue credit note."
    });
  }
}

export async function handleGetCreditNoteDetails(req: any, res: any, adminDb: any) {
  const id = String(req.params.id || "").trim();
  if (!id) {
    return res.status(400).json({
      success: false,
      error: "Credit note ID or number is required."
    });
  }

  try {
    const result = await getCreditNoteByIdOrNumber(adminDb, id);
    if (!result.success) {
      return res.status(404).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    console.error("Error fetching credit note details:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch credit note details."
    });
  }
}

export async function handleListCreditNotes(req: any, res: any, adminDb: any) {
  try {
    const filters = {
      orderId: req.query.orderId ? String(req.query.orderId) : undefined,
      financialYear: req.query.financialYear ? String(req.query.financialYear) : undefined,
      customerType: req.query.customerType ? String(req.query.customerType) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 50
    };

    const result = await listGstCreditNotes(adminDb, filters);
    return res.json(result);
  } catch (err: any) {
    console.error("Error listing credit notes:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to list credit notes."
    });
  }
}

export async function handleUpdateCreditNoteGstReportingStatus(req: any, res: any, adminDb: any) {
  const id = String(req.params.id || "").trim();
  if (!id) {
    return res.status(400).json({
      success: false,
      error: "Credit note ID is required."
    });
  }

  const body = req.body || {};
  const adminEmail = (req as any).adminUser?.email || "admin@saandsha.com";

  if (!body.gstReportingStatus) {
    return res.status(400).json({
      success: false,
      error: "gstReportingStatus is required."
    });
  }

  try {
    const result = await updateCreditNoteGstReportingStatus(adminDb, {
      creditNoteId: id,
      gstReportingStatus: body.gstReportingStatus,
      taxLiabilityAdjusted: body.taxLiabilityAdjusted,
      gstReportingPeriod: body.gstReportingPeriod,
      gstAdjustmentReference: body.gstAdjustmentReference,
      updatedBy: adminEmail
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err: any) {
    console.error("Error updating credit note GST reporting status:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to update credit note GST reporting status."
    });
  }
}

export async function handleDownloadCreditNotePdf(req: any, res: any, adminDb: any) {
  const id = String(req.params.id || "").trim();
  if (!id) {
    return res.status(400).json({
      success: false,
      error: "Credit note ID or number is required."
    });
  }

  try {
    const result = await getCreditNoteByIdOrNumber(adminDb, id);
    if (!result.success || !result.creditNote) {
      return res.status(404).json({
        success: false,
        code: "CREDIT_NOTE_NOT_FOUND",
        error: `Credit note '${id}' not found.`
      });
    }

    if (req.query.format === "json" || (req.headers.accept && req.headers.accept.includes("application/json"))) {
      return res.json({
        success: true,
        creditNote: result.creditNote
      });
    }

    await streamGstCreditNotePdfResponse(result.creditNote, res);
  } catch (err: any) {
    console.error(`Error downloading credit note PDF for '${id}':`, err);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: "Failed to generate credit note PDF." });
    }
  }
}
