import { FindOptionsOrder, FindOptionsSelect, FindOptionsWhere, Repository } from 'typeorm';
import { PaginationDto } from '../../../presentation/dto/common/pagination.dto';

export interface IPaginatedType<T> {
    items: T[];
    total: number;
    page: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}

export abstract class BaseService<T> {
    constructor(protected readonly repository: Repository<T>) {}

    protected async paginate(
        pagination?: PaginationDto,
        options: {
            relations?: string[];
            where?: FindOptionsWhere<T> | FindOptionsWhere<T>[];
            order?: FindOptionsOrder<T>;
            select?: FindOptionsSelect<T>;
        } = {},
    ): Promise<IPaginatedType<T>> {
        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortDirection = 'DESC',
        } = pagination || {};

        const skip = (page - 1) * limit;

        // Create a properly typed order object
        const defaultOrder = { [sortBy]: sortDirection };

        // Use the provided order or the default order
        const finalOrder = options.order || (defaultOrder as FindOptionsOrder<T>);

        const [items, total] = await this.repository.findAndCount({
            skip,
            take: limit,
            order: finalOrder,
            relations: options.relations,
            where: options.where,
            select: options.select,
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
