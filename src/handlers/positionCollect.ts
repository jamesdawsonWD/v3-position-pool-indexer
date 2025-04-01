import { NonfungiblePositionManager, Position } from "generated";
import { ZERO_BI } from './utils/constants';
import { loadTransaction } from './utils/index';

NonfungiblePositionManager.Collect.handlerWithLoader({
    loader: async ({ event, context }) => {
        const positionId = `${event.chainId}-${event.params.tokenId}`;
        const position = await context.Position.get(positionId);
        return [position];
    },

    handler: async ({ event, context, loaderReturn }) => {
        if (!loaderReturn) return;

        const [
            positionRO,
        ] = loaderReturn as [Position,];

        const timestamp = event.block.timestamp;

        // burn entity
        const transaction = await loadTransaction(
            event.transaction.hash,
            event.block.number,
            timestamp,
            event.transaction.gasPrice || ZERO_BI,
            context
        );

        const position = { ...positionRO }

        // we can always assume the position exists
        position.lastUpdatedTimestamp = transaction.timestamp;
        position.collectedFeesToken0 = position.collectedFeesToken0 + event.params.amount0;
        position.collectedFeesToken1 = position.collectedFeesToken1 + event.params.amount1;

        const collect = {
            id: `${transaction.id}-${event.logIndex}`,
            transaction_id: transaction.id,
            position_id: positionRO.id,
            timestamp: BigInt(timestamp),
            tokenId: event.params.tokenId,
            recipient: event.params.recipient,
            amount0: event.params.amount0,
            amount1: event.params.amount1,
            logIndex: BigInt(event.logIndex)
        };

        context.Position.set(position);
        context.PositionCollect.set(collect);
    },
});