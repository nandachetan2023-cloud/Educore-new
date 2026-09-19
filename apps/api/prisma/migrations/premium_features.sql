-- Upgrade schema with premium features
-- Perform this migration after reviewing all changes

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user subscription tracking
-- Track subscription status for free/premium users
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    subscription_level VARCHAR(20) NOT NULL DEFAULT 'free',
    plan_type VARCHAR(50) NOT NULL,
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    payment_gateway VARCHAR(50) NOT NULL,
    payment_reference VARCHAR(100) NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    cancellation_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, status)
);

-- Create subscription features/policies
CREATE TABLE IF NOT EXISTS subscription_policies (
    id SERIAL PRIMARY KEY,
    feature_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    restriction_type VARCHAR(50) NOT NULL,
    limit_value INTEGER,
    free_limit INTEGER NOT NULL DEFAULT 0,
    premium_limit INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bundle related tables
CREATE TABLE IF NOT EXISTS course_bundles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    image_url VARCHAR(1000),
    slug VARCHAR(200) NOT NULL UNIQUE,
    cover_image VARCHAR(1000),
    price DECIMAL(10,2) NOT NULL,
    discount DECIMAL(5,2) DEFAULT 0,
    final_price DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    is_featured BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bundle items relationship
CREATE TABLE IF NOT EXISTS bundle_items (
    id SERIAL PRIMARY KEY,
    bundle_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (bundle_id) REFERENCES course_bundles(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE(bundle_id, course_id)
);

-- Create group learning tables
CREATE TABLE IF NOT EXISTS study_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    image_url VARCHAR(1000),
    slug VARCHAR(200) NOT NULL UNIQUE,
    creator_id INTEGER NOT NULL,
    join_code VARCHAR(20) NOT NULL UNIQUE,
    max_members INTEGER DEFAULT 100,
    member_count INTEGER DEFAULT 1,
    is_public BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Group members
CREATE TABLE IF NOT EXISTS group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(group_id, user_id)
);

-- Group discussions
CREATE TABLE IF NOT EXISTS group_discussions (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Group activities (likes, comments, etc.)
CREATE TABLE IF NOT EXISTS group_activities (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    target_id INTEGER,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create live streaming tables
CREATE TABLE IF NOT EXISTS live_sessions (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL,
    instructor_id INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    stream_url VARCHAR(500),
    recording_url VARCHAR(500),
    platform VARCHAR(50) DEFAULT 'custom',
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    viewer_count INTEGER DEFAULT 0,
    is_replay_available BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Live session participants
CREATE TABLE IF NOT EXISTS live_participants (
    id SERIAL PRIMARY KEY,
    live_session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (live_session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(live_session_id, user_id)
);

-- Create AI recommendations tracking
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    recommendation_score DECIMAL(3,2) NOT NULL,
    reason VARCHAR(200),
    viewed BOOLEAN DEFAULT FALSE,
    clicked BOOLEAN DEFAULT FALSE,
    enrolled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE(user_id, course_id)
);

-- Premium certificate templates
CREATE TABLE IF NOT EXISTS premium_certificate_templates (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(200) NOT NULL,
    template_file VARCHAR(1000),
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- Create payment processing history
CREATE TABLE IF NOT EXISTS payment_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    course_id INTEGER,
    bundle_id INTEGER,
    subscription_id INTEGER,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    payment_gateway VARCHAR(50) NOT NULL,
    gateway_transaction_id VARCHAR(100) NOT NULL,
    gateway_response JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
    FOREIGN KEY (bundle_id) REFERENCES course_bundles(id) ON DELETE SET NULL,
    FOREIGN KEY (subscription_id) REFERENCES user_subscriptions(id) ON DELETE SET NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscription_policies_feature ON subscription_policies(feature_name);
CREATE INDEX IF NOT EXISTS idx_course_bundles_status ON course_bundles(status);
CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle_id ON bundle_items(bundle_id);
CREATE INDEX IF NOT EXISTS idx_study_groups_creator ON study_groups(creator_id);
CREATE INDEX IF NOT EXISTS idx_study_groups_slug ON study_groups(slug);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_discussions_group_id ON group_discussions(group_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_course_id ON live_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_instructor_id ON live_sessions(instructor_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_participants_session_id ON live_participants(live_session_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user ON ai_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_course ON ai_recommendations(course_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_gateway_transaction_id ON payment_history(gateway_transaction_id);

-- Create custom content tables for certificates
CREATE TABLE IF NOT EXISTS custom_certificate_sections (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL,
    section_name VARCHAR(100) NOT NULL,
    content_type VARCHAR(50) NOT NULL,
    content_value TEXT,
    x_position DECIMAL(5,2),
    y_position DECIMAL(5,2),
    width DECIMAL(5,2),
    height DECIMAL(5,2),
    font_size DECIMAL(4,2),
    font_family VARCHAR(50),
    alignment VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (template_id) REFERENCES premium_certificate_templates(id) ON DELETE CASCADE
);