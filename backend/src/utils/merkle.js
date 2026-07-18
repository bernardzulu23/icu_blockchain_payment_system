const crypto = require('crypto');

/**
 * Build a binary Merkle tree over sorted payment leaves.
 * Each leaf is sha256(studentId|amount) per Pseudocode 1 batch anchoring.
 */
function hashLeaf(studentId, amount) {
  const payload = `${String(studentId)}|${String(amount)}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function merkleRoot(leaves) {
  if (!leaves.length) {
    return crypto.createHash('sha256').update('empty-batch').digest('hex');
  }
  let level = [...leaves].sort();
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || left;
      next.push(
        crypto
          .createHash('sha256')
          .update(`${left}${right}`)
          .digest('hex')
      );
    }
    level = next;
  }
  return level[0];
}

function computeBatchMerkleRoot(payments) {
  const leaves = payments.map((p) =>
    hashLeaf(p.student_id || p.studentId, p.amount)
  );
  return merkleRoot(leaves);
}

module.exports = { hashLeaf, merkleRoot, computeBatchMerkleRoot };
