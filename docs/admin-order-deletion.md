# Admin order deletion

In **Orders dashboard → Details**, the **Delete order permanently** action is available after cancellation. The confirmation identifies the selected order and warns that deletion cannot be undone. Cancel first using the existing status control so stock is reconciled; deletion does not separately restore stock or automatically cancel an active order.

The same-origin `POST /api/admin/orders/delete` endpoint requires an authenticated admin, a valid order ID and matching order number. It rechecks cancellation on the server and calls Payload deletion with access control enabled in a commerce transaction. Existing collection hooks continue to refuse orders with money-ledger records and retain operational deletion history when that subsystem is initialized. The action does not bypass legacy inventory reconciliation or financial restrictions.

This removes the order document, not associated audit/financial history, checkout idempotency records, email jobs, analytics or R2 receipts. It is not a customer-data erasure tool. No receipts or history are purged. Existing queued notifications remain subject to the existing delivery rules. No production orders were deleted while implementing or testing this feature.
