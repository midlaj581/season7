const { saveAuctionState, loadAuctionState } = require('../config/db');
const { defaultAuctionState } = require('../config/defaultData');

let auctionState = { ...defaultAuctionState };
let previousBidSnapshot = null;

async function initAuction() {
  const fromDb = await loadAuctionState();
  if (fromDb) {
    auctionState = { ...defaultAuctionState, ...fromDb.auctionState };
    previousBidSnapshot = fromDb.previousBidSnapshot || null;
    return;
  }

  await persistAuctionState();
}

function getAuctionState() {
  return auctionState;
}

function setAuctionState(nextState) {
  auctionState = nextState;
  return auctionState;
}

function patchAuctionState(nextValues) {
  auctionState = { ...auctionState, ...nextValues };
  return auctionState;
}

function getPreviousBidSnapshot() {
  return previousBidSnapshot;
}

function setPreviousBidSnapshot(snapshot) {
  previousBidSnapshot = snapshot;
}

async function persistAuctionState() {
  await saveAuctionState({ auctionState, previousBidSnapshot });
}

module.exports = {
  initAuction,
  getAuctionState,
  setAuctionState,
  patchAuctionState,
  getPreviousBidSnapshot,
  setPreviousBidSnapshot,
  persistAuctionState,
};
