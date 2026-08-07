const ApiError = require("../utils/ApiError.util");

/**
 * The reimbursement transition table — doc 04 §4. One frozen map, one source of truth.
 * Real enum, no DRAFT: waiting -> head_approve -> fin_approve -> transfer, off-ramps
 * rejected/delete. Keys are `${from}->${to}`.
 *
 * Not used by any single endpoint — shared by #41 POST /reimbursements (auto-verify check)
 * and #47 POST /reimbursements/:id/status (every transition) in Reimbursement.helper.js.
 * Nothing in this file is mocked — this is real business logic, not fixture data.
 *
 * assertAuthorized() below checks each edge's `requires` flag for real, against booleans
 * Reimbursement.helper.js resolves with direct StaffDept queries (isHead/isFinance are
 * project/department-scoped and need a real join — see doc 04 §2/§3 — so they can't be read
 * off the still-mock-permissive req.scope the way other routes' access control currently is;
 * this file and its caller are real regardless of that broader gap).
 */
const TRANSITIONS = {
  "waiting->head_approve": { requires: "isHeadOrAutoVerify" },
  "waiting->rejected": { requires: "isHead", needs: ["reason"] },
  "waiting->delete": { requires: "isRequester" },
  "head_approve->fin_approve": { requires: "isFinance", needs: ["tracking_id"] },
  "head_approve->rejected": { requires: "isFinance", needs: ["reason"] },
  "fin_approve->transfer": { requires: "isOwner" },
  "rejected->waiting": { requires: "isRequester" },
  "rejected->delete": { requires: "isRequester" },
};

class ApprovalHelper {
  /** Throws 422 INVALID_TRANSITION if `from -> to` isn't a real edge. */
  static assertTransition(from, to) {
    const edge = TRANSITIONS[`${from}->${to}`];
    if (!edge) {
      throw new ApiError(422, "INVALID_TRANSITION", `Cannot move from '${from}' to '${to}'.`);
    }
    return edge;
  }

  /** True if the requester is themselves head of the department — fires the auto-verify path
   *  described in doc 04 §4: two status rows inserted in one transaction at creation time. */
  static shouldAutoVerifyHead({ isRequesterHeadOfDepartment }) {
    return Boolean(isRequesterHeadOfDepartment);
  }

  /** Throws 403 if the caller doesn't hold the flag `edge.requires` demands. `isHeadOrAutoVerify`
   *  covers both the auto-verify path (checked separately at creation, doc 04 §4) and a
   *  different head manually approving — either way it collapses to "is the caller head of
   *  this department," so it's treated the same as `isHead` here. */
  static assertAuthorized(edge, { isHead, isFinance, isOwner, isRequester }) {
    const flags = { isHead, isHeadOrAutoVerify: isHead, isFinance, isOwner, isRequester };
    if (!flags[edge.requires]) {
      throw ApiError.forbidden(`This action requires ${edge.requires}.`);
    }
  }
}

module.exports = { ApprovalHelper, TRANSITIONS };
