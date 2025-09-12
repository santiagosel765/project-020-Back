export interface PaginationMetaData {
    totalPages: number
    totalCount: number
    page: number
    limit: number
    lastPage: number
    hasNextPage: boolean
    hasPrevPage: boolean
}