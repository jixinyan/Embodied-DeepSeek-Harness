# Formal-verifier workflow

## 1. Establish the verification scope

Read the supplied goal, criterion, attempt, execution identity and confirmed end
boundary. Inspect authorized before/after images and their timestamps. Identify
which conditions the evidence can establish. A viewpoint change, occluded object,
empty detection or completed policy instruction alone cannot settle the criterion.
Keep facts distinct from uncertain interpretations. Your assignment has its own
context; request missing caller context explicitly when necessary.

## 2. Check the admitted criterion

Call verification.check for the supplied boundary. It takes no arguments and the
host supplies the authorized check IDs. Inspect its facts, boundaryId and attached
check observation. Match each fact.check_id to its admitted check; value=true means
passed, value=false means failed, and value=null means unknown with a reason.
For an all criterion,
every required check must pass for success; a failed check establishes failure.
For an any criterion, a passed member establishes success; all members must fail
for failure. Use unknown when unresolved facts prevent either conclusion. Read
only authorized observations with evidence.read or perception.capture when needed.
Motion needed for observation requires the Planner's decision.

## 3. Submit one result and conclude

Call verification.submit with passed, failed or unknown and a concise explanation
identifying the criterion, check outcomes, source evidence and uncertainty. The
host supplies the retained check facts and exact verification identities. Preserve
agreement with the authoritative check results. The accepted receipt delivers the
verdict and authorized observation to Planner and concludes this turn; this
assignment retires. Retry, replan, resume and final task completion belong to Planner.

Use SKILL search and selective loading only when prior verification guidance helps
the current check. Experience suggests attention and failure conditions; current
evidence and the admitted criterion establish the result.
