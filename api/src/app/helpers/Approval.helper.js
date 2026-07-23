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
 * TODO(mock): each edge's `requires` (isHead / isFinance / isOwner / isRequester /
 * isHeadOrAutoVerify) is data, not enforcement — nothing currently checks it against the
 * caller's scope. `assertTransition()` only validates the state machine shape (is this edge
 * real at all), not who's allowed to walk it. Reimbursement.routes.js's #47 route has no
 * requireScope() call today, only requireReauth (step-up) — the per-transition role check
 * described here needs wiring into changeStatus() once scope stops being a fixture.
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
}

module.exports = { ApprovalHelper, TRANSITIONS };
