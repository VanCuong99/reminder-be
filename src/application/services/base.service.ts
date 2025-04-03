import { Repository } from 'typeorm';
import { PaginationInput } from '../../shared/types/graphql/inputs/pagination.input';
import { IPaginatedType } from '../../shared/types/graphql/outputs/pagination.response';

export abstract class BaseService<T> {
    constructor(protected readonly repository: Repository<T>) {}

    protected async paginate(
        pagination?: PaginationInput,
        options: {
            relations?: string[];
            where?: any;
            order?: any;
        } = {},
    ): Promise<IPaginatedType<T>> {
        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortDirection = 'DESC',
        } = pagination || {};

        const skip = (page - 1) * limit;

        // Merge default order with custom order if provided
        const order = options.order || { [sortBy]: sortDirection };

        const [items, total] = await this.repository.findAndCount({
            skip,
            take: limit,
            order,
            relations: options.relations,
            where: options.where,
        });

        const totalPages = Math.ceil(total / limit);

        return {
            items,
            total,
            page,
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1,
        };
    }
}
