import {
  Token,
  Account,
  _Strategy,
  YieldAggregator,
  VaultDailySnapshot,
  VaultHourlySnapshot,
  FinancialsDailySnapshot,
  UsageMetricsDailySnapshot,
  UsageMetricsHourlySnapshot,
} from "../../generated/schema";
import * as utils from "./utils";
import * as constants from "./constants";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { ERC20 as ERC20Contract } from "../../generated/Registry_v1/ERC20";

export function getOrCreateStrategy(
  vaultAddress: Address,
  _strategyAddress: Address,
  performanceFee: BigInt
): _Strategy {
  let strategy = _Strategy.load(_strategyAddress.toHexString());

  if (!strategy) {
    strategy = new _Strategy(_strategyAddress.toHexString());
    strategy.lastReport = constants.BIGINT_ZERO;
    strategy.vaultAddress = vaultAddress;
    strategy.performanceFee = performanceFee;
  }
  return strategy;
}

export function getOrCreateAccount(id: string): Account {
  let account = Account.load(id);

  if (!account) {
    account = new Account(id);
    account.save();

    const protocol = getOrCreateYieldAggregator(constants.ETHEREUM_PROTOCOL_ID);

    protocol.cumulativeUniqueUsers += 1;
    protocol.save();
  }

  return account;
}

export function getOrCreateYieldAggregator(id: string): YieldAggregator {
  let protocol = YieldAggregator.load(id);

  if (!protocol) {
    protocol = new YieldAggregator(constants.ETHEREUM_PROTOCOL_ID);
    protocol.name = "Yearn v2";
    protocol.slug = "yearn-v2";
    protocol.schemaVersion = "1.2.0";
    protocol.subgraphVersion = "1.0.0";
    protocol.methodologyVersion = "1.0.0";
    protocol.network = constants.Network.MAINNET;
    protocol.type = constants.ProtocolType.YIELD;

    //////// Quantitative Data ////////
    protocol.totalValueLockedUSD = constants.BIGDECIMAL_ZERO;
    protocol.protocolControlledValueUSD = constants.BIGDECIMAL_ZERO;
    protocol.cumulativeSupplySideRevenueUSD = constants.BIGDECIMAL_ZERO;
    protocol.cumulativeProtocolSideRevenueUSD = constants.BIGDECIMAL_ZERO;
    protocol.cumulativeTotalRevenueUSD = constants.BIGDECIMAL_ZERO;
    protocol.cumulativeUniqueUsers = 0;

    protocol._vaultIds = [];
  }

  return protocol;
}

export function getOrCreateToken(address: Address): Token {
  let token = Token.load(address.toHexString());

  if (!token) {
    token = new Token(address.toHexString());

    const contract = ERC20Contract.bind(address);

    token.name = utils.readValue<string>(contract.try_name(), "");
    token.symbol = utils.readValue<string>(contract.try_symbol(), "");
    token.decimals = utils
      .readValue<BigInt>(contract.try_decimals(), constants.BIGINT_ZERO)
      .toI32() as u8;

    token.save();
  }

  return token;
}

export function getOrCreateFinancialDailySnapshots(
  block: ethereum.Block
): FinancialsDailySnapshot {
  let id = block.timestamp.toI64() / constants.SECONDS_PER_DAY;
  let financialMetrics = FinancialsDailySnapshot.load(id.toString());

  if (!financialMetrics) {
    financialMetrics = new FinancialsDailySnapshot(id.toString());
    financialMetrics.protocol = constants.ETHEREUM_PROTOCOL_ID;

    financialMetrics.totalValueLockedUSD = constants.BIGDECIMAL_ZERO;
    financialMetrics.protocolControlledValueUSD = constants.BIGDECIMAL_ZERO;
    financialMetrics.dailySupplySideRevenueUSD = constants.BIGDECIMAL_ZERO;
    financialMetrics.cumulativeSupplySideRevenueUSD = constants.BIGDECIMAL_ZERO;
    financialMetrics.dailyProtocolSideRevenueUSD = constants.BIGDECIMAL_ZERO;
    financialMetrics.cumulativeProtocolSideRevenueUSD =
      constants.BIGDECIMAL_ZERO;

    financialMetrics.dailyTotalRevenueUSD = constants.BIGDECIMAL_ZERO;
    financialMetrics.cumulativeTotalRevenueUSD = constants.BIGDECIMAL_ZERO;

    financialMetrics.blockNumber = block.number;
    financialMetrics.timestamp = block.timestamp;

    financialMetrics.save();
  }

  return financialMetrics;
}

export function getOrCreateUsageMetricsDailySnapshot(
  block: ethereum.Block
): UsageMetricsDailySnapshot {
  let id: i64 = block.timestamp.toI64() / constants.SECONDS_PER_DAY;
  let usageMetrics = UsageMetricsDailySnapshot.load(id.toString());

  if (!usageMetrics) {
    usageMetrics = new UsageMetricsDailySnapshot(id.toString());
    usageMetrics.protocol = constants.ETHEREUM_PROTOCOL_ID;

    usageMetrics.dailyActiveUsers = 0;
    usageMetrics.cumulativeUniqueUsers = 0;
    usageMetrics.dailyTransactionCount = 0;
    usageMetrics.dailyDepositCount = 0;
    usageMetrics.dailyWithdrawCount = 0;

    usageMetrics.blockNumber = block.number;
    usageMetrics.timestamp = block.timestamp;

    usageMetrics.save();
  }

  return usageMetrics;
}

export function getOrCreateUsageMetricsHourlySnapshot(
  block: ethereum.Block
): UsageMetricsHourlySnapshot {
  let metricsID: string = (block.timestamp.toI64() / constants.SECONDS_PER_DAY)
    .toString()
    .concat("-")
    .concat((block.timestamp.toI64() / constants.SECONDS_PER_HOUR).toString());
  let usageMetrics = UsageMetricsHourlySnapshot.load(metricsID);

  if (!usageMetrics) {
    usageMetrics = new UsageMetricsHourlySnapshot(metricsID);
    usageMetrics.protocol = constants.ETHEREUM_PROTOCOL_ID;

    usageMetrics.hourlyActiveUsers = 0;
    usageMetrics.cumulativeUniqueUsers = 0;
    usageMetrics.hourlyTransactionCount = 0;
    usageMetrics.hourlyDepositCount = 0;
    usageMetrics.hourlyWithdrawCount = 0;

    usageMetrics.blockNumber = block.number;
    usageMetrics.timestamp = block.timestamp;

    usageMetrics.save();
  }

  return usageMetrics;
}

export function getOrCreateVaultsDailySnapshots(
  vaultAddress: Address,
  block: ethereum.Block
): VaultDailySnapshot {
  let id: string = vaultAddress
    .toHexString()
    .concat((block.timestamp.toI64() / constants.SECONDS_PER_DAY).toString());
  let vaultSnapshots = VaultDailySnapshot.load(id);

  if (!vaultSnapshots) {
    vaultSnapshots = new VaultDailySnapshot(id);
    vaultSnapshots.protocol = constants.ETHEREUM_PROTOCOL_ID;
    vaultSnapshots.vault = vaultAddress.toHexString();

    vaultSnapshots.totalValueLockedUSD = constants.BIGDECIMAL_ZERO;
    vaultSnapshots.inputTokenBalance = constants.BIGINT_ZERO;
    vaultSnapshots.outputTokenSupply = constants.BIGINT_ZERO;
    vaultSnapshots.outputTokenPriceUSD = constants.BIGDECIMAL_ZERO;
    vaultSnapshots.pricePerShare = constants.BIGDECIMAL_ZERO;
    vaultSnapshots.stakedOutputTokenAmount = constants.BIGINT_ZERO;
    vaultSnapshots.rewardTokenEmissionsAmount = [constants.BIGINT_ZERO];
    vaultSnapshots.rewardTokenEmissionsUSD = [constants.BIGDECIMAL_ZERO];

    vaultSnapshots.blockNumber = block.number;
    vaultSnapshots.timestamp = block.timestamp;

    vaultSnapshots.save();
  }

  return vaultSnapshots;
}

export function getOrCreateVaultsHourlySnapshots(
  vaultAddress: Address,
  block: ethereum.Block
): VaultHourlySnapshot {
  let id: string = vaultAddress
    .toHexString()
    .concat((block.timestamp.toI64() / constants.SECONDS_PER_DAY).toString())
    .concat("-")
    .concat((block.timestamp.toI64() / constants.SECONDS_PER_HOUR).toString());
  let vaultSnapshots = VaultHourlySnapshot.load(id);

  if (!vaultSnapshots) {
    vaultSnapshots = new VaultHourlySnapshot(id);
    vaultSnapshots.protocol = constants.ETHEREUM_PROTOCOL_ID;
    vaultSnapshots.vault = vaultAddress.toHexString();

    vaultSnapshots.totalValueLockedUSD = constants.BIGDECIMAL_ZERO;
    vaultSnapshots.inputTokenBalance = constants.BIGINT_ZERO;
    vaultSnapshots.outputTokenSupply = constants.BIGINT_ZERO;
    vaultSnapshots.outputTokenPriceUSD = constants.BIGDECIMAL_ZERO;
    vaultSnapshots.pricePerShare = constants.BIGDECIMAL_ZERO;
    vaultSnapshots.stakedOutputTokenAmount = constants.BIGINT_ZERO;
    vaultSnapshots.rewardTokenEmissionsAmount = [constants.BIGINT_ZERO];
    vaultSnapshots.rewardTokenEmissionsUSD = [constants.BIGDECIMAL_ZERO];

    vaultSnapshots.blockNumber = block.number;
    vaultSnapshots.timestamp = block.timestamp;

    vaultSnapshots.save();
  }

  return vaultSnapshots;
}
