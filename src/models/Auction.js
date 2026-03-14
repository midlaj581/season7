// PPL Season 7 — Auction.js — upgraded
const { saveAuctionState, loadAuctionState } = require('../config/db');
const { defaultAuctionState } = require('../config/defaultData');

const UNDO_STACK_MAX = 5;

let auctionState = { ...defaultAuctionState };
let undoStack = [];

function migrateSnapshotToStack(snapshot) {
  if (snapshot && typeof snapshot === 'object') {
    undoStack = [snapshot];
  } else {
    undoStack = Array.isArray(snapshot) ? snapshot.slice(0, UNDO_STACK_MAX) : [];
  }
}

async function initAuction() {
  const fromDb = await loadAuctionState();
  if (fromDb) {
    auctionState = { ...defaultAuctionState, ...fromDb.auctionState };
    const stack = Array.isArray(fromDb.undoStack) && fromDb.undoStack.length
      ? fromDb.undoStack
      : fromDb.previousBidSnapshot ?? null;
    migrateSnapshotToStack(stack);
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
  return undoStack[0] || null;
}

function setPreviousBidSnapshot(snapshot) {
  if (!snapshot) return;
  undoStack.unshift(snapshot);
  if (undoStack.length > UNDO_STACK_MAX) undoStack.pop();
}

function getUndoStack() {
  return [...undoStack];
}

function popUndoSnapshot() {
  return undoStack.shift() || null;
}

function clearUndoStack() {
  undoStack = [];
}

async function persistAuctionState() {
  await saveAuctionState({ auctionState, previousBidSnapshot: undoStack });
}

async function replaceAuction(nextAuctionState, nextUndoStack = null) {
  auctionState = { ...defaultAuctionState, ...(nextAuctionState || {}) };
  undoStack = Array.isArray(nextUndoStack) ? nextUndoStack.slice(0, UNDO_STACK_MAX) : [];
  await persistAuctionState();
}

module.exports = {
  initAuction,
  getAuctionState,
  setAuctionState,
  patchAuctionState,
  getPreviousBidSnapshot,
  setPreviousBidSnapshot,
  getUndoStack,
  popUndoSnapshot,
  clearUndoStack,
  persistAuctionState,
  replaceAuction,
};
