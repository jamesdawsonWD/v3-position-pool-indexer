import { NonfungiblePositionManager, Position } from "generated";
import { loadTransaction } from './utils/index';
import { ZERO_BI } from './utils/constants';

NonfungiblePositionManager.IncreaseLiquidity.handlerWithLoader({
    loader: async ({ event, context }) => {
        const positionId = `${event.chainId}-${event.params.tokenId}`;
        const position = await context.Position.get(positionId);
        return [position];
    },

    handler: async ({ event, context, loaderReturn }) => {
        if (!loaderReturn) return;

        const [
            positionRO,
        ] = loaderReturn as [Position];

        const transaction = await loadTransaction(
            event.transaction.hash,
            event.block.number,
            event.block.timestamp,
            event.transaction.gasPrice || ZERO_BI,
            context
        );

        const position = { ...positionRO }

        // we can always assume the position exists
        position.lastUpdatedTimestamp = transaction.timestamp;
        position.depositedToken0 = position.depositedToken0 + event.params.amount0;
        position.depositedToken1 = position.depositedToken1 + event.params.amount1;
        position.liquidity = position.liquidity + event.params.liquidity;

        const increaseLiquidity = {
            amount0: event.params.amount0,
            amount1: event.params.amount1,
            tokenId: event.params.tokenId,
            id: `${transaction.id}-${event.logIndex}`,
            transaction_id: transaction.id,
            timestamp: transaction.timestamp,
            position_id: positionRO.id,
            origin: event.transaction.from || '',
            liquidity: event.params.liquidity,
            logIndex: BigInt(event.logIndex),
        };

        context.Position.set(position);
        context.IncreaseLiquidity.set(increaseLiquidity);

    }
});
