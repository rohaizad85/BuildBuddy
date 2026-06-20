// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\supabase-client.js

import SUPABASE_CONFIG from '../config/config.js';

class SupabaseClient {
    constructor() {
        this.url = SUPABASE_CONFIG.url;
        this.anonKey = SUPABASE_CONFIG.anonKey;
        this.headers = {
            'apikey': this.anonKey,
            'Authorization': `Bearer ${this.anonKey}`,
            'Content-Type': 'application/json'
        };

        // Storage API
        this.storage = {
            from: (bucket) => new SupabaseStorageClient(bucket, this)
        };
    }

    from(table) {
        return new SupabaseQueryBuilder(table, this);
    }
}

// ===== STORAGE CLIENT =====
class SupabaseStorageClient {
    constructor(bucket, client) {
        this.bucket = bucket;
        this.client = client;
        this.path = '';
    }

    getPublicUrl(path) {
        const url = `${this.client.url}/storage/v1/object/public/${this.bucket}/${path}`;
        return { data: { publicUrl: url } };
    }

    async list(path = '') {
        try {
            const url = `${this.client.url}/storage/v1/object/list/${this.bucket}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'apikey': this.client.anonKey,
                    'Authorization': `Bearer ${this.client.anonKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prefix: path })
            });

            if (!response.ok) {
                const errorText = await response.text();
                return { data: null, error: new Error(`HTTP ${response.status}: ${errorText}`) };
            }

            const data = await response.json();
            return { data, error: null };
        } catch (error) {
            return { data: null, error };
        }
    }

    async upload(path, file, options = {}) {
        try {
            const url = `${this.client.url}/storage/v1/object/${this.bucket}/${path}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'apikey': this.client.anonKey,
                    'Authorization': `Bearer ${this.client.anonKey}`
                },
                body: file
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Upload error:', response.status, errorText);
                return { data: null, error: new Error(`HTTP ${response.status}: ${errorText}`) };
            }

            const data = await response.json();
            return { data, error: null };
        } catch (error) {
            console.error('Upload exception:', error);
            return { data: null, error };
        }
    }

    async remove(paths) {
        try {
            const filesToDelete = Array.isArray(paths) ? paths : [paths];

            console.log('🗑️ Deleting files:', filesToDelete);

            const results = [];
            let hasError = false;
            let errorMessage = '';

            for (const filePath of filesToDelete) {
                const url = `${this.client.url}/storage/v1/object/${this.bucket}/${encodeURIComponent(filePath)}`;

                console.log(`🗑️ DELETE URL: ${url}`);

                const response = await fetch(url, {
                    method: 'DELETE',
                    headers: {
                        'apikey': this.client.anonKey,
                        'Authorization': `Bearer ${this.client.anonKey}`
                    }
                });

                if (response.ok || response.status === 204) {
                    console.log(`✅ Deleted: ${filePath}`);
                    results.push({ path: filePath, success: true });
                } else {
                    const errorText = await response.text();
                    console.error(`❌ Failed to delete ${filePath}:`, response.status, errorText);
                    hasError = true;
                    errorMessage += `Failed to delete ${filePath}: ${errorText}\n`;
                }
            }

            if (hasError) {
                return { data: results, error: new Error(errorMessage) };
            }

            return { data: results, error: null };
        } catch (error) {
            console.error('Delete exception:', error);
            return { data: null, error };
        }
    }
}

// ===== QUERY BUILDER =====
class SupabaseQueryBuilder {
    constructor(table, client) {
        this.table = table;
        this.client = client;
        this.selectColumns = '*';
        this.filters = [];
        this.orderByColumn = null;
        this.orderDirection = 'asc';
        this.limitCount = null;
        this.operation = 'select';
        this.updateData = null;
        this.insertData = null;
        this.singleResult = false;
        this.maybeSingleResult = false;
    }

    select(columns = '*') {
        this.selectColumns = columns;
        this.operation = 'select';
        return this;
    }

    eq(column, value) {
        this.filters.push({ column, operator: 'eq', value });
        return this;
    }

    neq(column, value) {
        this.filters.push({ column, operator: 'neq', value });
        return this;
    }

    gt(column, value) {
        this.filters.push({ column, operator: 'gt', value });
        return this;
    }

    lt(column, value) {
        this.filters.push({ column, operator: 'lt', value });
        return this;
    }

    gte(column, value) {
        this.filters.push({ column, operator: 'gte', value });
        return this;
    }

    lte(column, value) {
        this.filters.push({ column, operator: 'lte', value });
        return this;
    }

    like(column, pattern) {
        this.filters.push({ column, operator: 'like', value: pattern });
        return this;
    }

    // ===== NEW: IN OPERATOR =====
    in(column, values) {
        if (!Array.isArray(values) || values.length === 0) {
            throw new Error('in() requires a non-empty array');
        }
        // For string values, wrap in quotes
        const valueString = values.map(v => {
            if (typeof v === 'string') return `"${v}"`;
            return v;
        }).join(',');
        this.filters.push({ column, operator: 'in', value: `(${valueString})` });
        return this;
    }

    // ===== NEW: IS OPERATOR =====
    is(column, value) {
        if (value === null) {
            this.filters.push({ column, operator: 'is', value: 'null' });
        } else if (value === 'null') {
            this.filters.push({ column, operator: 'is', value: 'null' });
        } else {
            this.filters.push({ column, operator: 'is', value: value });
        }
        return this;
    }

    // ===== NEW: NOT OPERATOR =====
    not(column, operator, value) {
        this.filters.push({ column, operator: `not.${operator}`, value });
        return this;
    }

    order(column, options) {
        if (typeof options === 'string') {
            this.orderByColumn = column;
            this.orderDirection = options;
        } else if (typeof options === 'object' && options !== null) {
            this.orderByColumn = column;
            this.orderDirection = options.ascending === false ? 'desc' : 'asc';
        } else {
            this.orderByColumn = column;
            this.orderDirection = 'asc';
        }
        return this;
    }

    limit(count) {
        this.limitCount = count;
        return this;
    }

    single() {
        this.singleResult = true;
        return this;
    }

    maybeSingle() {
        this.maybeSingleResult = true;
        return this;
    }

    insert(data) {
        this.insertData = data;
        this.operation = 'insert';
        return this;
    }

    update(data) {
        this.updateData = data;
        this.operation = 'update';
        return this;
    }

    delete() {
        this.operation = 'delete';
        return this;
    }

    buildSelectUrl() {
        let url = `${this.client.url}/rest/v1/${this.table}?select=${encodeURIComponent(this.selectColumns)}`;

        this.filters.forEach(filter => {
            let value = filter.value;
            // Handle special operators
            if (filter.operator === 'is') {
                url += `&${filter.column}=is.${value}`;
                return;
            } else if (filter.operator === 'in') {
                url += `&${filter.column}=in.${value}`;
                return;
            } else if (filter.operator.startsWith('not.')) {
                url += `&${filter.column}=${filter.operator}.${value}`;
                return;
            }
            // Regular operator
            url += `&${filter.column}=${filter.operator}.${encodeURIComponent(String(value))}`;
        });

        if (this.orderByColumn) {
            url += `&order=${this.orderByColumn}.${this.orderDirection}`;
        }

        if (this.limitCount) {
            url += `&limit=${this.limitCount}`;
        }

        return url;
    }

    buildFilterUrl() {
        let url = `${this.client.url}/rest/v1/${this.table}?`;
        const params = [];

        this.filters.forEach(filter => {
            let value = filter.value;
            if (filter.operator === 'is') {
                params.push(`${filter.column}=is.${value}`);
            } else if (filter.operator === 'in') {
                params.push(`${filter.column}=in.${value}`);
            } else if (filter.operator.startsWith('not.')) {
                params.push(`${filter.column}=${filter.operator}.${value}`);
            } else {
                params.push(`${filter.column}=${filter.operator}.${encodeURIComponent(String(value))}`);
            }
        });

        url += params.join('&');
        return url;
    }

    async executeSelect() {
        const url = this.buildSelectUrl();

        const response = await fetch(url, {
            method: 'GET',
            headers: this.client.headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`HTTP ${response.status}: ${errorText}`);
            return { data: null, error };
        }

        const data = await response.json();

        if (this.singleResult || this.maybeSingleResult) {
            if (Array.isArray(data) && data.length > 0) {
                return { data: data[0], error: null };
            }
            return { data: null, error: null };
        }

        return { data, error: null };
    }

    async executeInsert() {
        const url = `${this.client.url}/rest/v1/${this.table}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                ...this.client.headers,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(Array.isArray(this.insertData) ? this.insertData : [this.insertData])
        });

        if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`HTTP ${response.status}: ${errorText}`);
            return { data: null, error };
        }

        const fetchUrl = `${this.client.url}/rest/v1/${this.table}?select=*&order=i_id.desc&limit=1`;

        const fetchResponse = await fetch(fetchUrl, {
            method: 'GET',
            headers: this.client.headers
        });

        if (!fetchResponse.ok) {
            return { data: [], error: null };
        }

        const data = await fetchResponse.json();

        if (this.singleResult || this.maybeSingleResult) {
            if (Array.isArray(data) && data.length > 0) {
                return { data: data[0], error: null };
            }
            return { data: null, error: null };
        }

        return { data, error: null };
    }

    async executeUpdate() {
        if (this.filters.length === 0) {
            throw new Error('UPDATE requires a WHERE clause. Use .eq() before .update()');
        }

        const url = this.buildFilterUrl();

        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                ...this.client.headers,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(this.updateData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`HTTP ${response.status}: ${errorText}`);
            return { data: null, error };
        }

        const data = await response.json();

        if (this.singleResult || this.maybeSingleResult) {
            if (Array.isArray(data) && data.length > 0) {
                return { data: data[0], error: null };
            }
            return { data: null, error: null };
        }

        return { data, error: null };
    }

    async executeDelete() {
        if (this.filters.length === 0) {
            throw new Error('DELETE requires a WHERE clause. Use .eq() before .delete()');
        }

        const url = this.buildFilterUrl();

        const response = await fetch(url, {
            method: 'DELETE',
            headers: this.client.headers
        });

        if (response.status === 204) {
            return { data: { success: true }, error: null };
        }

        if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`HTTP ${response.status}: ${errorText}`);
            return { data: null, error };
        }

        const text = await response.text();
        const data = text ? JSON.parse(text) : { success: true };
        return { data, error: null };
    }

    then(resolve, reject) {
        const execute = async () => {
            try {
                let result;

                switch (this.operation) {
                    case 'select':
                        result = await this.executeSelect();
                        break;
                    case 'insert':
                        result = await this.executeInsert();
                        break;
                    case 'update':
                        result = await this.executeUpdate();
                        break;
                    case 'delete':
                        result = await this.executeDelete();
                        break;
                    default:
                        result = await this.executeSelect();
                }

                resolve(result);
            } catch (error) {
                console.error('Supabase operation error:', error);
                reject({ data: null, error });
            }
        };

        execute();
    }
}

const supabase = new SupabaseClient();
export default supabase;