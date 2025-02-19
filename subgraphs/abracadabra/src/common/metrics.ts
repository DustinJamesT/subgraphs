import { BigDecimal, BigInt, Address, ethereum, dataSource } from "@graphprotocol/graph-ts";
import { Account, ActiveAccount } from "../../generated/schema";
import {
  SECONDS_PER_DAY,
  BIGDECIMAL_ZERO,
  ABRA_USER_REVENUE_SHARE,
  ABRA_PROTOCOL_REVENUE_SHARE,
  DEFAULT_DECIMALS,
  BIGDECIMAL_ONE,
  SECONDS_PER_HOUR,
  BIGINT_ZERO,
} from "./constants";
import {
  getOrCreateMarketDailySnapshot,
  getOrCreateUsageMetricsHourlySnapshot,
  getOrCreateUsageMetricsDailySnapshot,
  getOrCreateFinancials,
  getOrCreateLendingProtocol,
  getMarket,
  getOrCreateToken,
  getMIMAddress,
  getOrCreateMarketHourlySnapshot,
} from "./getters";
import { bigIntToBigDecimal } from "./utils/numbers";

// Update FinancialsDailySnapshots entity
export function updateFinancials(event: ethereum.Event, feesUSD: BigDecimal): void {
  // feesUSD is handled in handleLogWithdrawFees
  // totalValueLockedUSD is handled in updateTVL()
  let financialsDailySnapshots = getOrCreateFinancials(event);
  let protocol = getOrCreateLendingProtocol();
  let cumulativeTotalRevenueUSD = protocol.cumulativeTotalRevenueUSD.plus(feesUSD);
  let cumulativeSupplySideRevenueUSD = protocol.cumulativeSupplySideRevenueUSD.plus(
    feesUSD.times(ABRA_USER_REVENUE_SHARE),
  );
  let cumulativeProtocolSideRevenueUSD = protocol.cumulativeProtocolSideRevenueUSD.plus(
    feesUSD.times(ABRA_PROTOCOL_REVENUE_SHARE),
  );

  // // Update the block number and timestamp to that of the last transaction of that day
  financialsDailySnapshots.blockNumber = event.block.number;
  financialsDailySnapshots.timestamp = event.block.timestamp;
  financialsDailySnapshots.dailyTotalRevenueUSD = financialsDailySnapshots.dailyTotalRevenueUSD.plus(feesUSD); // feesUSD comes from logAccrue which is accounted in MIM
  financialsDailySnapshots.cumulativeTotalRevenueUSD = cumulativeTotalRevenueUSD;
  financialsDailySnapshots.dailySupplySideRevenueUSD = financialsDailySnapshots.dailySupplySideRevenueUSD.plus(
    feesUSD.times(ABRA_USER_REVENUE_SHARE),
  );
  financialsDailySnapshots.cumulativeSupplySideRevenueUSD = cumulativeSupplySideRevenueUSD;
  financialsDailySnapshots.dailyProtocolSideRevenueUSD = financialsDailySnapshots.dailyProtocolSideRevenueUSD.plus(
    feesUSD.times(ABRA_PROTOCOL_REVENUE_SHARE),
  );
  financialsDailySnapshots.cumulativeProtocolSideRevenueUSD = cumulativeProtocolSideRevenueUSD;

  protocol.cumulativeTotalRevenueUSD = cumulativeTotalRevenueUSD;
  protocol.cumulativeSupplySideRevenueUSD = cumulativeSupplySideRevenueUSD;
  protocol.cumulativeProtocolSideRevenueUSD = cumulativeProtocolSideRevenueUSD;
  financialsDailySnapshots.save();
}

export function updateUsageMetrics(event: ethereum.Event, from: Address, to: Address): void {
  // Number of days since Unix epoch
  let hourlyId: i64 = event.block.timestamp.toI64() / SECONDS_PER_HOUR;
  let dailyId: i64 = event.block.timestamp.toI64() / SECONDS_PER_DAY;
  let usageHourlySnapshot = getOrCreateUsageMetricsHourlySnapshot(event);
  let usageDailySnapshot = getOrCreateUsageMetricsDailySnapshot(event);
  let protocol = getOrCreateLendingProtocol();

  // Update the block number and timestamp to that of the last transaction of that day
  usageHourlySnapshot.blockNumber = event.block.number;
  usageHourlySnapshot.timestamp = event.block.timestamp;
  usageHourlySnapshot.hourlyTransactionCount += 1;

  usageDailySnapshot.blockNumber = event.block.number;
  usageDailySnapshot.timestamp = event.block.timestamp;
  usageDailySnapshot.dailyTransactionCount += 1;

  let fromAccountId = from.toHexString();
  let fromAccount = Account.load(fromAccountId);
  let toAccountId = to.toHexString();
  let toAccount = Account.load(toAccountId);

  if (!fromAccount) {
    fromAccount = new Account(fromAccountId);
    fromAccount.save();

    protocol.cumulativeUniqueUsers += 1;
    protocol.save();
  }

  if (!toAccount) {
    toAccount = new Account(fromAccountId);
    toAccount.save();

    protocol.cumulativeUniqueUsers += 1;
    protocol.save();
  }

  usageHourlySnapshot.cumulativeUniqueUsers = protocol.cumulativeUniqueUsers;
  usageDailySnapshot.cumulativeUniqueUsers = protocol.cumulativeUniqueUsers;

  // Combine the id and the user address to generate a unique user id for the hour/day
  let hourlyActiveAccountIdFrom = hourlyId.toString() + "-" + from.toHexString();
  let hourlyActiveAccountFrom = ActiveAccount.load(hourlyActiveAccountIdFrom);
  if (!hourlyActiveAccountFrom) {
    hourlyActiveAccountFrom = new ActiveAccount(hourlyActiveAccountIdFrom);
    hourlyActiveAccountFrom.save();
    usageHourlySnapshot.hourlyActiveUsers += 1;
  }

  let hourlyActiveAccountIdTo = hourlyId.toString() + "-" + to.toHexString();
  let hourlyActiveAccountTo = ActiveAccount.load(hourlyActiveAccountIdTo);
  if (!hourlyActiveAccountTo) {
    hourlyActiveAccountTo = new ActiveAccount(hourlyActiveAccountIdTo);
    hourlyActiveAccountTo.save();
    usageHourlySnapshot.hourlyActiveUsers += 1;
  }

  let dailyActiveAccountIdFrom = dailyId.toString() + "-" + from.toHexString();
  let dailyActiveAccountFrom = ActiveAccount.load(dailyActiveAccountIdFrom);
  if (!dailyActiveAccountFrom) {
    dailyActiveAccountFrom = new ActiveAccount(dailyActiveAccountIdFrom);
    dailyActiveAccountFrom.save();
    usageDailySnapshot.dailyActiveUsers += 1;
  }

  let dailyActiveAccountIdTo = dailyId.toString() + "-" + from.toHexString();
  let dailyActiveAccountTo = ActiveAccount.load(dailyActiveAccountIdTo);
  if (!dailyActiveAccountTo) {
    dailyActiveAccountTo = new ActiveAccount(dailyActiveAccountIdTo);
    dailyActiveAccountTo.save();
    usageDailySnapshot.dailyActiveUsers += 1;
  }

  usageHourlySnapshot.save();
  usageDailySnapshot.save();
}

// Update MarketDailySnapshot entity
export function updateMarketMetrics(event: ethereum.Event): void {
  let market = getMarket(event.address.toHexString());
  let marketHourlySnapshot = getOrCreateMarketHourlySnapshot(event, market.id);
  let marketDailySnapshot = getOrCreateMarketDailySnapshot(event, market.id);
  let protocol = getOrCreateLendingProtocol();

  marketHourlySnapshot.protocol = protocol.id;
  marketHourlySnapshot.market = market.id;
  marketHourlySnapshot.rates = market.rates;
  marketHourlySnapshot.totalValueLockedUSD = market.totalValueLockedUSD;
  marketHourlySnapshot.totalDepositBalanceUSD = market.totalDepositBalanceUSD;
  marketHourlySnapshot.cumulativeDepositUSD = market.cumulativeDepositUSD;
  marketHourlySnapshot.totalBorrowBalanceUSD = market.totalBorrowBalanceUSD;
  marketHourlySnapshot.cumulativeBorrowUSD = market.cumulativeBorrowUSD;
  marketHourlySnapshot.cumulativeLiquidateUSD = market.cumulativeLiquidateUSD;
  marketHourlySnapshot.inputTokenBalance = market.inputTokenBalance;
  marketHourlySnapshot.inputTokenPriceUSD = market.inputTokenPriceUSD;
  marketHourlySnapshot.outputTokenSupply = market.outputTokenSupply;
  marketHourlySnapshot.outputTokenPriceUSD = market.outputTokenPriceUSD;

  marketDailySnapshot.protocol = protocol.id;
  marketDailySnapshot.market = market.id;
  marketDailySnapshot.rates = market.rates;
  marketDailySnapshot.totalValueLockedUSD = market.totalValueLockedUSD;
  marketDailySnapshot.totalDepositBalanceUSD = market.totalDepositBalanceUSD;
  marketDailySnapshot.cumulativeDepositUSD = market.cumulativeDepositUSD;
  marketDailySnapshot.totalBorrowBalanceUSD = market.totalBorrowBalanceUSD;
  marketDailySnapshot.cumulativeBorrowUSD = market.cumulativeBorrowUSD;
  marketDailySnapshot.cumulativeLiquidateUSD = market.cumulativeLiquidateUSD;
  marketDailySnapshot.inputTokenBalance = market.inputTokenBalance;
  marketDailySnapshot.inputTokenPriceUSD = market.inputTokenPriceUSD;
  marketDailySnapshot.outputTokenSupply = market.outputTokenSupply;
  marketDailySnapshot.outputTokenPriceUSD = market.outputTokenPriceUSD;

  marketHourlySnapshot.save();
  marketHourlySnapshot.save();
}

export function updateTVL(event: ethereum.Event): void {
  // new user count handled in updateUsageMetrics
  // totalBorrowUSD handled updateTotalBorrowUSD
  let protocol = getOrCreateLendingProtocol();
  let financialsDailySnapshot = getOrCreateFinancials(event);
  let marketIDList = protocol.marketIDList;
  let protocolTotalValueLockedUSD = BIGDECIMAL_ZERO;
  let protocolMintedTokenSupply = BIGINT_ZERO;
  for (let i: i32 = 0; i < marketIDList.length; i++) {
    let marketAddress = marketIDList[i];
    let market = getMarket(marketAddress);
    protocolMintedTokenSupply = protocolMintedTokenSupply.plus(market.outputTokenSupply);
    protocolTotalValueLockedUSD = protocolTotalValueLockedUSD.plus(market.totalValueLockedUSD);
  }
  financialsDailySnapshot.mintedTokenSupplies = [protocolMintedTokenSupply];
  financialsDailySnapshot.totalValueLockedUSD = protocolTotalValueLockedUSD;
  financialsDailySnapshot.totalDepositBalanceUSD = protocolTotalValueLockedUSD;
  financialsDailySnapshot.blockNumber = event.block.number;
  financialsDailySnapshot.timestamp = event.block.timestamp;
  protocol.mintedTokenSupplies = [protocolMintedTokenSupply];
  protocol.totalValueLockedUSD = protocolTotalValueLockedUSD;
  protocol.totalDepositBalanceUSD = protocolTotalValueLockedUSD;

  financialsDailySnapshot.save();
  protocol.save();
}

export function updateTotalBorrows(event: ethereum.Event): void {
  // new user count handled in updateUsageMetrics
  let protocol = getOrCreateLendingProtocol();
  let financialsDailySnapshots = getOrCreateFinancials(event);
  let marketIDList = protocol.marketIDList;
  let mimPriceUSD = getOrCreateToken(Address.fromString(getMIMAddress(dataSource.network()))).lastPriceUSD;
  mimPriceUSD = mimPriceUSD.gt(BIGDECIMAL_ZERO) ? mimPriceUSD : BIGDECIMAL_ONE;
  let totalBorrowBalanceUSD = BIGDECIMAL_ZERO;
  for (let i: i32 = 0; i < marketIDList.length; i++) {
    let marketAddress = marketIDList[i];
    let market = getMarket(marketAddress);
    totalBorrowBalanceUSD = totalBorrowBalanceUSD.plus(
      bigIntToBigDecimal(market.outputTokenSupply, DEFAULT_DECIMALS).times(mimPriceUSD),
    );
  }
  financialsDailySnapshots.totalBorrowBalanceUSD = totalBorrowBalanceUSD;
  protocol.totalBorrowBalanceUSD = totalBorrowBalanceUSD;
  financialsDailySnapshots.save();
  protocol.save();
}

export function updateMarketStats(
  marketId: string,
  eventType: string,
  asset: string,
  amount: BigInt,
  event: ethereum.Event,
): void {
  let market = getMarket(marketId);
  let token = getOrCreateToken(Address.fromString(asset));
  let usageHourlySnapshot = getOrCreateUsageMetricsHourlySnapshot(event);
  let usageDailySnapshot = getOrCreateUsageMetricsDailySnapshot(event);
  let marketHourlySnapshot = getOrCreateMarketHourlySnapshot(event, market.id);
  let marketDailySnapshot = getOrCreateMarketDailySnapshot(event, market.id);
  let financialsDailySnapshot = getOrCreateFinancials(event);
  let protocol = getOrCreateLendingProtocol();
  let priceUSD = token.lastPriceUSD;
  if (eventType == "DEPOSIT") {
    let inputTokenBalance = market.inputTokenBalance.plus(amount);
    market.inputTokenBalance = inputTokenBalance;
    market.totalValueLockedUSD = bigIntToBigDecimal(inputTokenBalance, token.decimals).times(priceUSD);
    market.totalDepositBalanceUSD = bigIntToBigDecimal(inputTokenBalance, token.decimals).times(priceUSD);
    usageHourlySnapshot.hourlyDepositCount += 1;
    usageDailySnapshot.dailyDepositCount += 1;
    marketHourlySnapshot.cumulativeDepositUSD = marketHourlySnapshot.cumulativeDepositUSD.plus(
      bigIntToBigDecimal(amount, token.decimals).times(priceUSD),
    );
    marketDailySnapshot.cumulativeDepositUSD = marketDailySnapshot.cumulativeDepositUSD.plus(
      bigIntToBigDecimal(amount, token.decimals).times(priceUSD),
    );
    financialsDailySnapshot.cumulativeDepositUSD = financialsDailySnapshot.cumulativeDepositUSD.plus(
      bigIntToBigDecimal(amount, token.decimals).times(priceUSD),
    );
    protocol.cumulativeDepositUSD = protocol.cumulativeDepositUSD.plus(
      bigIntToBigDecimal(amount, token.decimals).times(priceUSD),
    );
  } else if (eventType == "WITHDRAW") {
    let inputTokenBalance = market.inputTokenBalance.minus(amount);
    market.inputTokenBalance = inputTokenBalance;
    market.totalValueLockedUSD = bigIntToBigDecimal(inputTokenBalance, token.decimals).times(priceUSD);
    market.totalDepositBalanceUSD = bigIntToBigDecimal(inputTokenBalance, token.decimals).times(priceUSD);
    usageHourlySnapshot.hourlyWithdrawCount += 1;
    usageDailySnapshot.dailyWithdrawCount += 1;
  } else if (eventType == "BORROW") {
    let outputTokenSupply = market.outputTokenSupply.plus(amount);
    market.outputTokenSupply = outputTokenSupply;
    market.totalBorrowBalanceUSD = bigIntToBigDecimal(outputTokenSupply, token.decimals).times(priceUSD);
    usageHourlySnapshot.hourlyBorrowCount += 1;
    usageDailySnapshot.dailyBorrowCount += 1;
    marketHourlySnapshot.cumulativeBorrowUSD = marketHourlySnapshot.cumulativeBorrowUSD.plus(
      bigIntToBigDecimal(amount, token.decimals).times(priceUSD),
    );
    marketDailySnapshot.cumulativeBorrowUSD = marketDailySnapshot.cumulativeBorrowUSD.plus(
      bigIntToBigDecimal(amount, token.decimals).times(priceUSD),
    );
    financialsDailySnapshot.cumulativeBorrowUSD = financialsDailySnapshot.cumulativeBorrowUSD.plus(
      bigIntToBigDecimal(amount, token.decimals).times(priceUSD),
    );
    protocol.cumulativeBorrowUSD = protocol.cumulativeBorrowUSD.plus(
      bigIntToBigDecimal(amount, token.decimals).times(priceUSD),
    );
  } else if (eventType == "REPAY") {
    let outputTokenSupply = market.outputTokenSupply.minus(amount);
    market.outputTokenSupply = outputTokenSupply;
    market.totalBorrowBalanceUSD = bigIntToBigDecimal(outputTokenSupply, token.decimals).times(priceUSD);
    usageHourlySnapshot.hourlyRepayCount += 1;
    usageDailySnapshot.dailyRepayCount += 1;
  }
  usageHourlySnapshot.blockNumber = event.block.number;
  usageHourlySnapshot.timestamp = event.block.timestamp;
  usageDailySnapshot.blockNumber = event.block.number;
  usageDailySnapshot.timestamp = event.block.timestamp;
  market.inputTokenPriceUSD = getOrCreateToken(Address.fromString(market.inputToken)).lastPriceUSD;
  market.outputTokenPriceUSD =
    asset.toLowerCase() == getMIMAddress(dataSource.network()).toLowerCase()
      ? priceUSD
      : getOrCreateToken(Address.fromString(getMIMAddress(dataSource.network()))).lastPriceUSD;
  market.save();
  usageDailySnapshot.save();
  usageDailySnapshot.save();
  marketHourlySnapshot.save();
  marketDailySnapshot.save();
  financialsDailySnapshot.save();
  protocol.save();
}
