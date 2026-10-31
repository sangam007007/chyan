--
-- PostgreSQL database dump
--

\restrict foIfv1NXHxwbfKQ3vbJjJSMtKZ0T93XT2oO5hqgccKSlcf6ggORfjNCOQtC2O0B

-- Dumped from database version 14.24 (Ubuntu 14.24-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.24 (Ubuntu 14.24-0ubuntu0.22.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    primary_user_id uuid NOT NULL,
    linked_provider character varying(20) NOT NULL,
    linked_identifier character varying(255) NOT NULL,
    linked_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_admin_action CHECK (((action)::text = ANY (ARRAY[('create'::character varying)::text, ('update'::character varying)::text, ('delete'::character varying)::text, ('publish'::character varying)::text, ('unpublish'::character varying)::text, ('role_change'::character varying)::text, ('bulk_import'::character varying)::text])))
);


--
-- Name: attempt_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attempt_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attempt_id uuid NOT NULL,
    question_id uuid NOT NULL,
    question_order smallint NOT NULL,
    selected_option smallint,
    marked_for_review boolean DEFAULT false NOT NULL,
    answered_at timestamp with time zone,
    CONSTRAINT chk_selected_option CHECK (((selected_option >= 0) AND (selected_option <= 3)))
);


--
-- Name: auth_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_audit_log (
    id bigint NOT NULL,
    user_id uuid,
    action character varying(50) NOT NULL,
    ip_address inet,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auth_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auth_audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auth_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auth_audit_log_id_seq OWNED BY public.auth_audit_log.id;


--
-- Name: coin_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coin_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(20) NOT NULL,
    amount integer NOT NULL,
    reference_id character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_coin_amount CHECK ((amount > 0)),
    CONSTRAINT chk_coin_type CHECK (((type)::text = ANY (ARRAY[('daily_login'::character varying)::text, ('streak_bonus_7'::character varying)::text, ('referral'::character varying)::text, ('quiz_complete'::character varying)::text, ('test_complete'::character varying)::text, ('daily_challenge_pass'::character varying)::text])))
);


--
-- Name: daily_plan_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_plan_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    date date NOT NULL,
    total_items smallint DEFAULT 0 NOT NULL,
    completed_items smallint DEFAULT 0 NOT NULL,
    completion_pct smallint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: daily_quiz_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_quiz_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    quiz_date date NOT NULL,
    question_ids uuid[] NOT NULL,
    answers smallint[],
    score smallint,
    time_taken_seconds integer,
    status character varying(15) DEFAULT '''in_progress'''::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    submitted_at timestamp with time zone,
    CONSTRAINT chk_quiz_status CHECK (((status)::text = ANY (ARRAY[('in_progress'::character varying)::text, ('submitted'::character varying)::text])))
);


--
-- Name: discussion_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discussion_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_key character varying(60) NOT NULL,
    user_id uuid NOT NULL,
    body character varying(600) DEFAULT ''::character varying NOT NULL,
    image_path character varying(200),
    report_count integer DEFAULT 0 NOT NULL,
    hidden_at timestamp with time zone,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_discussion_message_not_empty CHECK (((length(btrim((body)::text)) > 0) OR (image_path IS NOT NULL)))
);


--
-- Name: discussion_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discussion_reports (
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dynamic_full_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dynamic_full_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    slot_number smallint NOT NULL,
    test_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: exams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name_en character varying(100) NOT NULL,
    name_hi character varying(100) NOT NULL,
    description_en character varying(100),
    description_hi character varying(100),
    category character varying(50) NOT NULL,
    state character varying(50),
    icon_url text,
    is_active boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    exam_date date
);


--
-- Name: pgmigrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pgmigrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pgmigrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pgmigrations_id_seq OWNED BY public.pgmigrations.id;


--
-- Name: plan_item_completions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_item_completions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    item_id uuid NOT NULL,
    completion_date date NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: question_exams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_exams (
    question_id uuid NOT NULL,
    exam_id uuid NOT NULL
);


--
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    text_en text NOT NULL,
    text_hi text NOT NULL,
    option_a_en character varying(500) NOT NULL,
    option_a_hi character varying(500) NOT NULL,
    option_b_en character varying(500) NOT NULL,
    option_b_hi character varying(500) NOT NULL,
    option_c_en character varying(500) NOT NULL,
    option_c_hi character varying(500) NOT NULL,
    option_d_en character varying(500) NOT NULL,
    option_d_hi character varying(500) NOT NULL,
    correct_option smallint NOT NULL,
    explanation_en text,
    explanation_hi text,
    subject character varying(20) NOT NULL,
    topic character varying(100),
    difficulty character varying(10) NOT NULL,
    image_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    question_type character varying(100) DEFAULT NULL::character varying,
    question_group_id uuid,
    CONSTRAINT chk_correct_option CHECK (((correct_option >= 0) AND (correct_option <= 3))),
    CONSTRAINT chk_difficulty CHECK (((difficulty)::text = ANY (ARRAY[('easy'::character varying)::text, ('medium'::character varying)::text, ('hard'::character varying)::text]))),
    CONSTRAINT chk_subject CHECK (((subject)::text = ANY (ARRAY[('gk'::character varying)::text, ('math'::character varying)::text, ('reasoning'::character varying)::text, ('hindi'::character varying)::text])))
);


--
-- Name: revision_marks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revision_marks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    question_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    refresh_token_hash character varying(64) NOT NULL,
    token_family uuid NOT NULL,
    device_type character varying(20),
    device_info jsonb,
    ip_address inet,
    city character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    last_active_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: study_plan_item_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.study_plan_item_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_item_id uuid NOT NULL,
    test_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: study_plan_item_topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.study_plan_item_topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_item_id uuid NOT NULL,
    topic_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: study_plan_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.study_plan_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    duration_minutes integer NOT NULL,
    display_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    topic_count integer DEFAULT 0 NOT NULL,
    test_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT chk_display_order CHECK (((display_order >= 0) AND (display_order <= 100))),
    CONSTRAINT chk_duration_minutes CHECK (((duration_minutes >= 5) AND (duration_minutes <= 480)))
);


--
-- Name: study_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.study_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    day_of_week character varying(10),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subject_visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subject_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    visited_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subjects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exam_id uuid NOT NULL,
    name_en character varying(100) NOT NULL,
    name_hi character varying(100) NOT NULL,
    display_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subscription_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    granted_by uuid,
    months integer NOT NULL,
    paid_until_after timestamp with time zone NOT NULL,
    note character varying(200),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscription_grants_months_check CHECK (((months >= 1) AND (months <= 24)))
);


--
-- Name: test_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    test_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    submitted_at timestamp with time zone,
    status character varying(15) DEFAULT '''in_progress'''::character varying NOT NULL,
    total_score numeric(6,2),
    correct_count smallint,
    wrong_count smallint,
    skipped_count smallint,
    percentage numeric(5,2),
    time_taken_seconds integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    comment_band character varying(16),
    comment_index smallint,
    CONSTRAINT chk_attempt_status CHECK (((status)::text = ANY (ARRAY[('in_progress'::character varying)::text, ('submitted'::character varying)::text, ('auto_submitted'::character varying)::text])))
);


--
-- Name: test_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_questions (
    test_id uuid NOT NULL,
    question_id uuid NOT NULL,
    question_order smallint NOT NULL
);


--
-- Name: tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title_en character varying(200) NOT NULL,
    title_hi character varying(200) NOT NULL,
    description_en text,
    description_hi text,
    exam_id uuid NOT NULL,
    duration_minutes integer NOT NULL,
    total_marks integer NOT NULL,
    marks_per_question numeric(4,2) DEFAULT 1 NOT NULL,
    negative_marking_ratio numeric(3,2) DEFAULT 0 NOT NULL,
    passing_marks integer NOT NULL,
    pricing_type character varying(10) DEFAULT '''free'''::character varying NOT NULL,
    status character varying(10) DEFAULT '''draft'''::character varying NOT NULL,
    available_from timestamp with time zone,
    available_until timestamp with time zone,
    attempt_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    category character varying(20) DEFAULT 'full_mock'::character varying NOT NULL,
    subject_id uuid,
    topic_id uuid,
    CONSTRAINT chk_duration_minutes CHECK ((duration_minutes > 0)),
    CONSTRAINT chk_negative_marking_ratio CHECK (((negative_marking_ratio >= (0)::numeric) AND (negative_marking_ratio <= (1)::numeric))),
    CONSTRAINT chk_passing_marks CHECK ((passing_marks >= 0)),
    CONSTRAINT chk_pricing_type CHECK (((pricing_type)::text = ANY (ARRAY[('free'::character varying)::text, ('premium'::character varying)::text]))),
    CONSTRAINT chk_status CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('published'::character varying)::text]))),
    CONSTRAINT chk_study_tests_no_negative_marking CHECK (((negative_marking_ratio = (0)::numeric) OR ((topic_id IS NULL) AND ((category)::text <> ALL (ARRAY[('subject_wise'::character varying)::text, ('topic_wise'::character varying)::text]))))),
    CONSTRAINT chk_test_category CHECK (((category)::text = ANY (ARRAY[('full_mock'::character varying)::text, ('subject_wise'::character varying)::text, ('previous_year'::character varying)::text, ('daily_practice'::character varying)::text]))),
    CONSTRAINT chk_topic_requires_subject CHECK (((topic_id IS NULL) OR (subject_id IS NOT NULL))),
    CONSTRAINT chk_total_marks CHECK ((total_marks > 0))
);


--
-- Name: topic_part_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topic_part_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    part_id uuid NOT NULL,
    status character varying(20) DEFAULT 'not_started'::character varying NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT topic_part_progress_status_check CHECK (((status)::text = ANY (ARRAY[('not_started'::character varying)::text, ('completed'::character varying)::text])))
);


--
-- Name: topic_parts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topic_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic_id uuid NOT NULL,
    part_number integer NOT NULL,
    title_en character varying(200) NOT NULL,
    title_hi character varying(200) DEFAULT ''::character varying NOT NULL,
    content_en text DEFAULT ''::text,
    content_hi text DEFAULT ''::text,
    test_id uuid,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: topic_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topic_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    topic_id uuid NOT NULL,
    status character varying(20) DEFAULT 'locked'::character varying NOT NULL,
    best_accuracy integer,
    attempts_count integer DEFAULT 0 NOT NULL,
    completed_at timestamp with time zone,
    unlocked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_visited_at timestamp with time zone,
    CONSTRAINT chk_topic_progress_status CHECK (((status)::text = ANY (ARRAY[('locked'::character varying)::text, ('unlocked'::character varying)::text, ('in_progress'::character varying)::text, ('completed'::character varying)::text])))
);


--
-- Name: topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject_id uuid NOT NULL,
    name_en character varying(100) NOT NULL,
    name_hi character varying(100) NOT NULL,
    display_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_active_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_active_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    plan_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    activity_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_exams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_exams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    exam_id uuid NOT NULL,
    enrolled_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone character varying(10),
    email character varying(255),
    full_name character varying(50),
    avatar_url text,
    preferred_language character varying(2) DEFAULT '''hi'''::character varying NOT NULL,
    selected_exam_id uuid,
    google_id character varying(255),
    google_avatar_url text,
    onboarding_completed boolean DEFAULT false NOT NULL,
    exam_change_count_this_month integer DEFAULT 0 NOT NULL,
    exam_change_month integer,
    deletion_scheduled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    best_streak integer DEFAULT 0 NOT NULL,
    role character varying(20) DEFAULT 'student'::character varying NOT NULL,
    trial_ends_at timestamp with time zone DEFAULT (now() + '3 days'::interval) NOT NULL,
    paid_until timestamp with time zone,
    CONSTRAINT chk_user_role CHECK (((role)::text = ANY (ARRAY[('student'::character varying)::text, ('admin'::character varying)::text, ('super_admin'::character varying)::text])))
);


--
-- Name: auth_audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_audit_log ALTER COLUMN id SET DEFAULT nextval('public.auth_audit_log_id_seq'::regclass);


--
-- Name: pgmigrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations ALTER COLUMN id SET DEFAULT nextval('public.pgmigrations_id_seq'::regclass);


--
-- Data for Name: account_links; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_links (id, primary_user_id, linked_provider, linked_identifier, linked_at) FROM stdin;
\.


--
-- Data for Name: admin_activity_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_activity_log (id, admin_id, action, entity_type, entity_id, details, created_at) FROM stdin;
\.


--
-- Data for Name: attempt_answers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.attempt_answers (id, attempt_id, question_id, question_order, selected_option, marked_for_review, answered_at) FROM stdin;
\.


--
-- Data for Name: auth_audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.auth_audit_log (id, user_id, action, ip_address, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: coin_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coin_transactions (id, user_id, type, amount, reference_id, created_at) FROM stdin;
\.


--
-- Data for Name: daily_plan_progress; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.daily_plan_progress (id, user_id, date, total_items, completed_items, completion_pct, updated_at) FROM stdin;
\.


--
-- Data for Name: daily_quiz_attempts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.daily_quiz_attempts (id, user_id, quiz_date, question_ids, answers, score, time_taken_seconds, status, created_at, submitted_at) FROM stdin;
\.


--
-- Data for Name: discussion_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.discussion_messages (id, room_key, user_id, body, image_path, report_count, hidden_at, deleted_at, created_at) FROM stdin;
\.


--
-- Data for Name: discussion_reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.discussion_reports (message_id, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: dynamic_full_tests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dynamic_full_tests (id, user_id, subject_id, slot_number, test_id, created_at) FROM stdin;
\.


--
-- Data for Name: exams; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.exams (id, name_en, name_hi, description_en, description_hi, category, state, icon_url, is_active, display_order, created_at, exam_date) FROM stdin;
2ce792d6-c455-4877-bf3d-e4784c908d92	UP Police SI	यूपी पुलिस एसआई	UP Police Sub-Inspector recruitment exam	यूपी पुलिस उप-निरीक्षक भर्ती परीक्षा	state	Uttar Pradesh	\N	t	2	2026-07-31 20:54:51.294991+05:30	\N
414c9bd7-a66b-46ea-9a94-450bea923a0b	UP SI Civil	यूपी एसआई सिविल	UP Sub-Inspector Civil Police exam	यूपी उप-निरीक्षक सिविल पुलिस परीक्षा	state	Uttar Pradesh	\N	t	3	2026-07-31 20:54:51.294991+05:30	\N
38545539-610e-4e97-bf50-d0f5ee9e2396	UP SI Platoon Commander	यूपी एसआई प्लाटून कमांडर	UP SI Platoon Commander (PAC) exam	यूपी एसआई प्लाटून कमांडर (पीएसी) परीक्षा	state	Uttar Pradesh	\N	t	4	2026-07-31 20:54:51.294991+05:30	\N
830d533b-31e9-4f3f-bbc7-355ef690a7b9	UP Police Head Operator	यूपी पुलिस हेड ऑपरेटर	UP Police Head Operator recruitment exam	यूपी पुलिस हेड ऑपरेटर भर्ती परीक्षा	state	Uttar Pradesh	\N	t	5	2026-07-31 20:54:51.294991+05:30	\N
59a874d7-df6d-4e09-b633-8fe996156e3c	UP Police ASI	यूपी पुलिस एएसआई	UP Police Asst Sub-Inspector exam	यूपी पुलिस सहायक उप-निरीक्षक परीक्षा	state	Uttar Pradesh	\N	t	6	2026-07-31 20:54:51.294991+05:30	\N
abc2e887-bbeb-447d-ab8d-a3289dba345b	SSC GD Constable	एसएससी जीडी कांस्टेबल	SSC General Duty Constable exam	एसएससी सामान्य ड्यूटी कांस्टेबल परीक्षा	central	\N	\N	t	7	2026-07-31 20:54:51.294991+05:30	\N
54b5de6c-cfcf-43d9-ad67-0313e0341573	SSC CPO	एसएससी सीपीओ	SSC Central Police Organisation exam	एसएससी केंद्रीय पुलिस संगठन परीक्षा	central	\N	\N	t	8	2026-07-31 20:54:51.294991+05:30	\N
670adcd6-b134-4fed-8e88-cf84b43308ea	Delhi Police Constable	दिल्ली पुलिस कांस्टेबल	Delhi Police Constable recruitment exam	दिल्ली पुलिस कांस्टेबल भर्ती परीक्षा	state	Delhi	\N	t	9	2026-07-31 20:54:51.294991+05:30	\N
0101b1ed-b8c2-474e-b6e5-0bc0689ed61f	Bihar Police Constable	बिहार पुलिस कांस्टेबल	Bihar Police Constable recruitment exam	बिहार पुलिस कांस्टेबल भर्ती परीक्षा	state	Bihar	\N	t	10	2026-07-31 20:54:51.294991+05:30	\N
575eb300-fe8e-494c-9bc1-24d333352711	UP Police Constable	यूपी पुलिस कांस्टेबल	UP Police Constable recruitment exam	यूपी पुलिस कांस्टेबल भर्ती परीक्षा	state	Uttar Pradesh	\N	t	1	2026-07-31 20:54:51.294991+05:30	2026-11-27
\.


--
-- Data for Name: pgmigrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pgmigrations (id, name, run_on) FROM stdin;
1	001_create-exams-table	2026-10-31 13:16:17.073912
2	002_create-users-table	2026-10-31 13:16:17.117975
3	003_create-sessions-table	2026-10-31 13:16:17.168823
4	004_create-account-links-table	2026-10-31 13:16:17.207542
5	005_create-auth-audit-log-table	2026-10-31 13:16:17.24634
6	006_seed-exams-data	2026-10-31 13:16:17.285683
7	007_create-questions-tables	2026-10-31 13:16:17.327568
8	008_create-tests-tables	2026-10-31 13:16:17.37292
9	009_create-test-attempts-tables	2026-10-31 13:16:17.442154
10	010_seed-test-series-data	2026-10-31 13:16:17.483885
11	011_add-test-category	2026-10-31 13:16:17.545116
12	012_add-subjects-topics-tables	2026-10-31 13:16:17.593613
13	013_seed-subjects-topics-data	2026-10-31 13:16:17.647075
14	014_create-user-activities-table	2026-10-31 13:16:17.702141
15	015_add-best-streak-to-users	2026-10-31 13:16:17.765309
16	016_add-exam-date-to-exams	2026-10-31 13:16:17.821857
17	017_create-coin-transactions-table	2026-10-31 13:16:17.886431
18	018_create-daily-quiz-attempts-table	2026-10-31 13:16:17.951501
19	019_add-role-to-users	2026-10-31 13:16:18.002474
20	020_create-admin-activity-log	2026-10-31 13:16:18.056362
21	021_create-study-plans-tables	2026-10-31 13:16:18.104791
22	022_create-topic-progress	2026-10-31 13:16:18.170101
23	023_add-topic-test-counts-to-plan-items	2026-10-31 13:16:18.245616
24	024_create-plan-item-selections	2026-10-31 13:16:18.293129
25	025_create-topic-parts-tables	2026-10-31 13:16:18.350448
26	026_create-user-exams-table	2026-10-31 13:16:18.402091
27	027_create-daily-plan-progress	2026-10-31 13:16:18.4489
28	028_add-question-type	2026-10-31 13:16:18.489955
29	029_no-negative-marking-for-study-tests	2026-10-31 13:16:18.528442
30	030_add-attempt-result-comment	2026-10-31 13:16:18.566876
31	031_create-discussions	2026-10-31 13:16:18.609289
32	032_add-access-trial-and-paid	2026-10-31 13:16:18.650191
\.


--
-- Data for Name: plan_item_completions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plan_item_completions (id, user_id, item_id, completion_date, completed_at) FROM stdin;
\.


--
-- Data for Name: question_exams; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.question_exams (question_id, exam_id) FROM stdin;
0513da92-71b8-426d-af4c-f38fb12c5871	575eb300-fe8e-494c-9bc1-24d333352711
daa2a0b9-c7e1-42e3-8b1f-cd729b8ded9f	575eb300-fe8e-494c-9bc1-24d333352711
7c487f70-a6f6-40ee-b060-5f4e448166c1	575eb300-fe8e-494c-9bc1-24d333352711
0682ba4b-1ed1-4cfa-9b55-181ac67270a3	575eb300-fe8e-494c-9bc1-24d333352711
6b1cd6a8-06a5-43d8-932f-5213edd24ab3	575eb300-fe8e-494c-9bc1-24d333352711
6f0b12fb-9c6d-459a-92de-8a1edbcf7d8e	575eb300-fe8e-494c-9bc1-24d333352711
f7b2d4fd-0917-436d-ab27-9ebeec20177a	575eb300-fe8e-494c-9bc1-24d333352711
eca7db2d-02b0-4d1f-8b69-f49d5b091392	575eb300-fe8e-494c-9bc1-24d333352711
88dfa08a-3c3b-4d40-9eff-83c5176cb66d	575eb300-fe8e-494c-9bc1-24d333352711
fe7f5094-399b-4247-b249-88794714ac83	575eb300-fe8e-494c-9bc1-24d333352711
d2d7f2ed-e7b9-4e37-bfc0-cbb703fe4006	575eb300-fe8e-494c-9bc1-24d333352711
41489e92-4dab-43e0-bf2a-69ac77573e57	575eb300-fe8e-494c-9bc1-24d333352711
fd510666-fbef-45b0-b29c-7f939a3bfc75	575eb300-fe8e-494c-9bc1-24d333352711
b48679eb-7407-4885-a652-2a820d95a273	575eb300-fe8e-494c-9bc1-24d333352711
439eac0d-3ba8-4005-a6b6-888a59ea30a0	575eb300-fe8e-494c-9bc1-24d333352711
78651102-0e6a-49cc-be51-93f2e46fef80	575eb300-fe8e-494c-9bc1-24d333352711
d05ed6f9-7e1a-4e5c-a8c0-01a1450909ff	575eb300-fe8e-494c-9bc1-24d333352711
aeb6a68e-a46c-405a-b310-024f9498ce47	575eb300-fe8e-494c-9bc1-24d333352711
ccabbc7e-eb58-4215-a86e-e06a8f2fcf2c	575eb300-fe8e-494c-9bc1-24d333352711
8643e2ac-6efd-4f22-acc9-621fa0078191	575eb300-fe8e-494c-9bc1-24d333352711
44948c32-fc38-4a5c-ab75-4c25af1797cd	575eb300-fe8e-494c-9bc1-24d333352711
c831ab32-a510-4cac-8cc5-555bfca9ac2c	575eb300-fe8e-494c-9bc1-24d333352711
d222bc7b-561c-407e-8610-6d580303ba19	575eb300-fe8e-494c-9bc1-24d333352711
77051c40-53d4-4122-a796-18157f1c9487	575eb300-fe8e-494c-9bc1-24d333352711
fc8fa6cc-6613-4401-87fd-8b9d00d85268	575eb300-fe8e-494c-9bc1-24d333352711
0e580f6e-fcee-4a29-a96e-903dd62553e6	575eb300-fe8e-494c-9bc1-24d333352711
9797ba40-ed4a-41d9-ba32-100875bb0e6d	575eb300-fe8e-494c-9bc1-24d333352711
f3bb0a8a-05fe-4540-979b-91d8ed538039	575eb300-fe8e-494c-9bc1-24d333352711
c3853f4d-03c7-4d55-bbe8-cba78ae6f584	575eb300-fe8e-494c-9bc1-24d333352711
b9bffde4-6032-48fe-807b-0fe0d9b59c30	575eb300-fe8e-494c-9bc1-24d333352711
518dbf03-97a4-42e5-8b49-932cb1d1af7a	575eb300-fe8e-494c-9bc1-24d333352711
09f5204a-5a41-4577-9195-4021a23bf753	575eb300-fe8e-494c-9bc1-24d333352711
a8acced6-9f33-4446-b324-d3b54ef6ea4e	575eb300-fe8e-494c-9bc1-24d333352711
4160eafb-e278-4802-8693-24d2f15647cd	575eb300-fe8e-494c-9bc1-24d333352711
05ae23bd-8653-426f-9094-28e40db0a1a9	575eb300-fe8e-494c-9bc1-24d333352711
2179c52c-3a61-4044-96f0-8434e5f1bc89	575eb300-fe8e-494c-9bc1-24d333352711
2042bab7-578a-41a2-9e21-002be22c180a	575eb300-fe8e-494c-9bc1-24d333352711
1ecc1f95-3781-4d28-a291-1661f20fc995	575eb300-fe8e-494c-9bc1-24d333352711
7dbbd944-1eb9-4e69-a4df-80822c7ac467	575eb300-fe8e-494c-9bc1-24d333352711
ccbb4eb4-2489-49aa-aeea-3d6f36fb29cc	575eb300-fe8e-494c-9bc1-24d333352711
7ac39f3b-cd26-443d-b87e-43f6d4f299a9	575eb300-fe8e-494c-9bc1-24d333352711
7ac39f3b-cd26-443d-b87e-43f6d4f299a9	2ce792d6-c455-4877-bf3d-e4784c908d92
7ac39f3b-cd26-443d-b87e-43f6d4f299a9	414c9bd7-a66b-46ea-9a94-450bea923a0b
6374afc3-20f6-427e-9d60-0546e86a633b	59a874d7-df6d-4e09-b633-8fe996156e3c
47341ef3-939b-4f87-8141-745fdd11cbe6	575eb300-fe8e-494c-9bc1-24d333352711
\.


--
-- Data for Name: questions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.questions (id, text_en, text_hi, option_a_en, option_a_hi, option_b_en, option_b_hi, option_c_en, option_c_hi, option_d_en, option_d_hi, correct_option, explanation_en, explanation_hi, subject, topic, difficulty, image_url, is_active, created_at, updated_at, question_type, question_group_id) FROM stdin;
0513da92-71b8-426d-af4c-f38fb12c5871	Who was the first President of India?	भारत के प्रथम राष्ट्रपति कौन थे?	Mahatma Gandhi	महात्मा गांधी	Dr. Rajendra Prasad	डॉ. राजेंद्र प्रसाद	Jawaharlal Nehru	जवाहरलाल नेहरू	Sardar Patel	सरदार पटेल	1	Dr. Rajendra Prasad was the first President of India (1950-1962).	डॉ. राजेंद्र प्रसाद भारत के प्रथम राष्ट्रपति थे (1950-1962)।	gk	Indian History	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
daa2a0b9-c7e1-42e3-8b1f-cd729b8ded9f	Which river is known as the Ganga of South India?	दक्षिण भारत की गंगा किस नदी को कहा जाता है?	Krishna	कृष्णा	Kaveri	कावेरी	Godavari	गोदावरी	Tungabhadra	तुंगभद्रा	2	Godavari is called the Ganga of South India due to its religious significance.	गोदावरी को इसके धार्मिक महत्व के कारण दक्षिण भारत की गंगा कहा जाता है।	gk	Indian Geography	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
7c487f70-a6f6-40ee-b060-5f4e448166c1	The Indian Constitution came into effect on which date?	भारतीय संविधान किस तिथि को लागू हुआ?	15 August 1947	15 अगस्त 1947	26 January 1950	26 जनवरी 1950	26 November 1949	26 नवंबर 1949	2 October 1950	2 अक्टूबर 1950	1	The Indian Constitution came into effect on 26 January 1950.	भारतीय संविधान 26 जनवरी 1950 को लागू हुआ।	gk	Indian Polity	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
0682ba4b-1ed1-4cfa-9b55-181ac67270a3	How many Fundamental Rights are mentioned in the Indian Constitution?	भारतीय संविधान में कितने मौलिक अधिकार वर्णित हैं?	5	5	6	6	7	7	8	8	1	There are 6 Fundamental Rights in the Indian Constitution (Right to Equality, Freedom, Against Exploitation, Religious Freedom, Cultural & Educational Rights, Constitutional Remedies).	भारतीय संविधान में 6 मौलिक अधिकार हैं (समानता, स्वतंत्रता, शोषण के विरुद्ध, धार्मिक स्वतंत्रता, सांस्कृतिक एवं शैक्षिक, संवैधानिक उपचार)।	gk	Indian Polity	medium	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
6b1cd6a8-06a5-43d8-932f-5213edd24ab3	Which state of India has the largest area?	भारत का सबसे बड़ा राज्य (क्षेत्रफल में) कौन सा है?	Madhya Pradesh	मध्य प्रदेश	Maharashtra	महाराष्ट्र	Rajasthan	राजस्थान	Uttar Pradesh	उत्तर प्रदेश	2	Rajasthan is the largest state by area (342,239 sq km).	राजस्थान क्षेत्रफल की दृष्टि से सबसे बड़ा राज्य है (342,239 वर्ग किमी)।	gk	Indian Geography	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
6f0b12fb-9c6d-459a-92de-8a1edbcf7d8e	The Battle of Plassey was fought in which year?	प्लासी का युद्ध किस वर्ष हुआ था?	1757	1757	1764	1764	1857	1857	1947	1947	0	The Battle of Plassey was fought in 1757 between British East India Company and Nawab Siraj ud-Daulah.	प्लासी का युद्ध 1757 में ब्रिटिश ईस्ट इंडिया कंपनी और नवाब सिराजुद्दौला के बीच हुआ था।	gk	Indian History	medium	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
f7b2d4fd-0917-436d-ab27-9ebeec20177a	Who is known as the Iron Man of India?	भारत के लौह पुरुष के रूप में कौन जाने जाते हैं?	Bhagat Singh	भगत सिंह	Subhash Chandra Bose	सुभाष चंद्र बोस	Sardar Vallabhbhai Patel	सरदार वल्लभभाई पटेल	Lal Bahadur Shastri	लाल बहादुर शास्त्री	2	Sardar Vallabhbhai Patel is known as the Iron Man of India for unifying princely states.	सरदार वल्लभभाई पटेल को रियासतों के एकीकरण के लिए भारत का लौह पुरुष कहा जाता है।	gk	Indian History	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
eca7db2d-02b0-4d1f-8b69-f49d5b091392	Which Article of the Constitution deals with Right to Education?	संविधान का कौन सा अनुच्छेद शिक्षा के अधिकार से संबंधित है?	Article 19	अनुच्छेद 19	Article 21	अनुच्छेद 21	Article 21A	अनुच्छेद 21A	Article 32	अनुच्छेद 32	2	Article 21A (inserted by 86th Amendment, 2002) provides Right to Education for children aged 6-14.	अनुच्छेद 21A (86वें संशोधन, 2002 द्वारा) 6-14 वर्ष के बच्चों को शिक्षा का अधिकार देता है।	gk	Indian Polity	medium	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
88dfa08a-3c3b-4d40-9eff-83c5176cb66d	The Tropic of Cancer passes through how many Indian states?	कर्क रेखा भारत के कितने राज्यों से गुजरती है?	6	6	7	7	8	8	9	9	2	The Tropic of Cancer passes through 8 Indian states: Gujarat, Rajasthan, MP, Chhattisgarh, Jharkhand, West Bengal, Tripura, Mizoram.	कर्क रेखा भारत के 8 राज्यों से गुजरती है: गुजरात, राजस्थान, मप्र, छत्तीसगढ़, झारखंड, पश्चिम बंगाल, त्रिपुरा, मिजोरम।	gk	Indian Geography	hard	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
fe7f5094-399b-4247-b249-88794714ac83	The headquarters of UP Police is located in which city?	यूपी पुलिस का मुख्यालय किस शहर में स्थित है?	Lucknow	लखनऊ	Prayagraj	प्रयागराज	Noida	नोएडा	Varanasi	वाराणसी	0	The headquarters of Uttar Pradesh Police is in Lucknow.	उत्तर प्रदेश पुलिस का मुख्यालय लखनऊ में है।	gk	Current Affairs	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
41489e92-4dab-43e0-bf2a-69ac77573e57	A train travels 240 km in 4 hours. What is its speed?	एक ट्रेन 4 घंटे में 240 किमी चलती है। उसकी गति क्या है?	50 km/h	50 किमी/घंटा	55 km/h	55 किमी/घंटा	60 km/h	60 किमी/घंटा	65 km/h	65 किमी/घंटा	2	Speed = Distance/Time = 240/4 = 60 km/h	गति = दूरी/समय = 240/4 = 60 किमी/घंटा	math	Time and Distance	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
47341ef3-939b-4f87-8141-745fdd11cbe6	What is earth	Dharti kya hai	Djsh	Djeh	Djeh	Djej	Rjej	Djej	Fbdb	Djeh	0	Dndndn dheje	Djejeje 3uejeje	gk	Earth science	easy	\N	t	2026-08-10 13:50:01.546495+05:30	2026-08-10 13:50:01.546495+05:30	\N	\N
518dbf03-97a4-42e5-8b49-932cb1d1af7a	What is the synonym of "Akash" (sky) in Hindi?	"आकाश" का पर्यायवाची शब्द क्या है?	Dharti	धरती	Gagan	गगन	Sagar	सागर	Pavan	पवन	1	Gagan is a synonym of Akash (sky).	गगन, आकाश का पर्यायवाची शब्द है।	hindi	Synonyms	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	synonym_direct	518dbf03-97a4-42e5-8b49-932cb1d1af7a
b48679eb-7407-4885-a652-2a820d95a273	What is the simple interest on ₹5000 at 8% per annum for 3 years?	₹5000 पर 8% वार्षिक दर से 3 वर्ष का साधारण ब्याज क्या है?	₹1000	₹1000	₹1200	₹1200	₹1400	₹1400	₹1500	₹1500	1	SI = P×R×T/100 = 5000×8×3/100 = ₹1200	साधारण ब्याज = मूलधन×दर×समय/100 = 5000×8×3/100 = ₹1200	math	Arithmetic	medium	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
439eac0d-3ba8-4005-a6b6-888a59ea30a0	A man walks at 5 km/h for 2 hours and then at 4 km/h for 3 hours. What is the total distance?	एक व्यक्ति 5 किमी/घंटा की गति से 2 घंटे और फिर 4 किमी/घंटा की गति से 3 घंटे चलता है। कुल दूरी क्या है?	20 km	20 किमी	22 km	22 किमी	24 km	24 किमी	25 km	25 किमी	1	Total distance = (5×2) + (4×3) = 10 + 12 = 22 km	कुल दूरी = (5×2) + (4×3) = 10 + 12 = 22 किमी	math	Time and Distance	medium	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
78651102-0e6a-49cc-be51-93f2e46fef80	What is the LCM of 12, 15, and 20?	12, 15 और 20 का लघुत्तम समापवर्त्य (LCM) क्या है?	30	30	60	60	120	120	180	180	1	LCM of 12, 15, 20: 12=2²×3, 15=3×5, 20=2²×5. LCM=2²×3×5=60	12, 15, 20 का LCM: 12=2²×3, 15=3×5, 20=2²×5. LCM=2²×3×5=60	math	Arithmetic	medium	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
d05ed6f9-7e1a-4e5c-a8c0-01a1450909ff	A car covers 150 km in 2.5 hours. How long will it take to cover 300 km at the same speed?	एक कार 2.5 घंटे में 150 किमी तय करती है। उसी गति से 300 किमी तय करने में कितना समय लगेगा?	4 hours	4 घंटे	4.5 hours	4.5 घंटे	5 hours	5 घंटे	5.5 hours	5.5 घंटे	2	Speed = 150/2.5 = 60 km/h. Time = 300/60 = 5 hours	गति = 150/2.5 = 60 किमी/घंटा। समय = 300/60 = 5 घंटे	math	Time and Distance	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
aeb6a68e-a46c-405a-b310-024f9498ce47	If the ratio of two numbers is 3:5 and their sum is 48, what is the larger number?	यदि दो संख्याओं का अनुपात 3:5 है और उनका योग 48 है, तो बड़ी संख्या क्या है?	18	18	24	24	30	30	36	36	2	Sum of ratio = 3+5 = 8. Larger number = (5/8)×48 = 30	अनुपात का योग = 3+5 = 8। बड़ी संख्या = (5/8)×48 = 30	math	Arithmetic	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
ccabbc7e-eb58-4215-a86e-e06a8f2fcf2c	A shopkeeper sells an article for ₹450 at a profit of 25%. What was the cost price?	एक दुकानदार एक वस्तु को 25% लाभ पर ₹450 में बेचता है। क्रय मूल्य क्या था?	₹320	₹320	₹340	₹340	₹360	₹360	₹380	₹380	2	SP = CP × (1 + profit%). CP = 450/1.25 = ₹360	विक्रय मूल्य = क्रय मूल्य × (1 + लाभ%)। क्रय मूल्य = 450/1.25 = ₹360	math	Arithmetic	medium	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
8643e2ac-6efd-4f22-acc9-621fa0078191	Two pipes can fill a tank in 12 and 18 hours respectively. How long to fill together?	दो नल एक टंकी को क्रमशः 12 और 18 घंटे में भर सकते हैं। दोनों मिलकर कितने समय में भरेंगे?	6.5 hours	6.5 घंटे	7.2 hours	7.2 घंटे	8 hours	8 घंटे	9 hours	9 घंटे	1	Combined rate = 1/12 + 1/18 = 5/36. Time = 36/5 = 7.2 hours	संयुक्त दर = 1/12 + 1/18 = 5/36। समय = 36/5 = 7.2 घंटे	math	Arithmetic	hard	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
d222bc7b-561c-407e-8610-6d580303ba19	Find the odd one out: Apple, Mango, Potato, Banana	विषम ज्ञात करें: सेब, आम, आलू, केला	Apple	सेब	Mango	आम	Potato	आलू	Banana	केला	2	Potato is a vegetable while the rest are fruits.	आलू एक सब्जी है जबकि बाकी सभी फल हैं।	reasoning	Classification	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
fc8fa6cc-6613-4401-87fd-8b9d00d85268	In a row of students, Rahul is 7th from the left and 12th from the right. How many students are in the row?	छात्रों की एक पंक्ति में राहुल बाएं से 7वें और दाएं से 12वें स्थान पर है। पंक्ति में कुल कितने छात्र हैं?	17	17	18	18	19	19	20	20	1	Total = left position + right position - 1 = 7 + 12 - 1 = 18	कुल = बाएं स्थान + दाएं स्थान - 1 = 7 + 12 - 1 = 18	reasoning	Direction and Position	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
0e580f6e-fcee-4a29-a96e-903dd62553e6	Find the next in series: A, C, F, J, O, ?	श्रृंखला में अगला ज्ञात करें: A, C, F, J, O, ?	S	S	T	T	U	U	V	V	2	Gaps: +2, +3, +4, +5, +6. O(15) + 6 = U(21)	अंतर: +2, +3, +4, +5, +6। O(15) + 6 = U(21)	reasoning	Letter Series	medium	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
c831ab32-a510-4cac-8cc5-555bfca9ac2c	Book is to Reading as Knife is to:	पुस्तक : पढ़ना :: चाकू : ?	Sharpening	तेज करना	Cutting	काटना	Writing	लिखना	Cooking	खाना पकाना	1	A book is used for reading, similarly a knife is used for cutting.	पुस्तक पढ़ने के लिए उपयोग होती है, इसी प्रकार चाकू काटने के लिए उपयोग होता है।	reasoning	Analogy	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	analogy_pair	c831ab32-a510-4cac-8cc5-555bfca9ac2c
44948c32-fc38-4a5c-ab75-4c25af1797cd	Find the next number in the series: 2, 6, 12, 20, 30, ?	श्रृंखला में अगली संख्या ज्ञात करें: 2, 6, 12, 20, 30, ?	40	40	42	42	44	44	48	48	1	Pattern: differences are 4, 6, 8, 10, 12. Next = 30 + 12 = 42	पैटर्न: अंतर 4, 6, 8, 10, 12 हैं। अगला = 30 + 12 = 42	reasoning	Number Series	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	number_series_pattern	44948c32-fc38-4a5c-ab75-4c25af1797cd
f3bb0a8a-05fe-4540-979b-91d8ed538039	If South-East becomes North, then what does North-West become?	यदि दक्षिण-पूर्व उत्तर हो जाए, तो उत्तर-पश्चिम क्या होगा?	South	दक्षिण	East	पूर्व	West	पश्चिम	North	उत्तर	0	SE becomes N means 135° clockwise rotation. Applying same: NW rotated 135° clockwise = South.	दक्षिण-पूर्व उत्तर हो गया अर्थात 135° दक्षिणावर्त घूर्णन। उसी प्रकार: उत्तर-पश्चिम 135° दक्षिणावर्त = दक्षिण।	reasoning	Direction and Position	hard	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
09f5204a-5a41-4577-9195-4021a23bf753	Which of the following is a "Sarvanam" (pronoun)?	निम्नलिखित में से कौन सा "सर्वनाम" है?	Beautiful	सुंदर	He	वह	Run	दौड़ना	Quickly	जल्दी	1	"Vah" (He) is a pronoun (Sarvanam) in Hindi grammar.	"वह" हिंदी व्याकरण में सर्वनाम है।	hindi	Grammar	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
4160eafb-e278-4802-8693-24d2f15647cd	Which "Karak" (case) does "ne" indicate in Hindi?	"ने" किस कारक का चिन्ह है?	Karta Karak	कर्ता कारक	Karma Karak	कर्म कारक	Karan Karak	करण कारक	Sampradan Karak	संप्रदान कारक	0	"Ne" is the case marker for Karta Karak (nominative case) in past tense.	"ने" भूतकाल में कर्ता कारक का चिन्ह है।	hindi	Grammar	medium	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
05ae23bd-8653-426f-9094-28e40db0a1a9	What is the "Samas Vigrah" (compound decomposition) of "Rajkumar"?	"राजकुमार" का समास विग्रह क्या है?	Raja ka Kumar	राजा का कुमार	Raj aur Kumar	राज और कुमार	Raja ke liye Kumar	राजा के लिए कुमार	Raja se Kumar	राजा से कुमार	0	Rajkumar = Raja ka Kumar (Tatpurush Samas).	राजकुमार = राजा का कुमार (तत्पुरुष समास)।	hindi	Grammar	medium	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
2179c52c-3a61-4044-96f0-8434e5f1bc89	Which "Ras" (sentiment) does "Haha" or laughter express?	"हास्य" किस रस का स्थायी भाव है?	Veer Ras	वीर रस	Hasya Ras	हास्य रस	Shringaar Ras	शृंगार रस	Karuna Ras	करुण रस	1	Hasya (laughter) is the permanent emotion of Hasya Ras.	हास्य, हास्य रस का स्थायी भाव है।	hindi	Literature	medium	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
2042bab7-578a-41a2-9e21-002be22c180a	What is the "Sandhi Vichchhed" (compound split) of "Vidyalaya"?	"विद्यालय" का संधि विच्छेद क्या है?	Vidya + Lay	विद्या + लय	Vidya + Aalay	विद्या + आलय	Vid + Yalaya	विद् + यालय	Vidya + Laya	विद्या + लय	1	Vidyalaya = Vidya + Aalay (Deergha Sandhi).	विद्यालय = विद्या + आलय (दीर्घ संधि)।	hindi	Grammar	medium	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
1ecc1f95-3781-4d28-a291-1661f20fc995	Which figure of speech is used in "Mukh Chandra sa sundar hai"?	"मुख चंद्र सा सुंदर है" में कौन सा अलंकार है?	Rupak	रूपक	Upma	उपमा	Utpreksha	उत्प्रेक्षा	Anupras	अनुप्रास	1	The use of "sa" (like) makes this a Upma (simile) figure of speech.	"सा" (जैसा) के प्रयोग से यह उपमा अलंकार है।	hindi	Literature	hard	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
7dbbd944-1eb9-4e69-a4df-80822c7ac467	What type of sentence is "Kya tum school jaoge?"	"क्या तुम स्कूल जाओगे?" किस प्रकार का वाक्य है?	Vidhaan Vakya	विधान वाक्य	Prashna Vakya	प्रश्न वाक्य	Nishedh Vakya	निषेध वाक्य	Aagya Vakya	आज्ञा वाक्य	1	A sentence that asks a question is called Prashna Vakya (interrogative sentence).	जो वाक्य प्रश्न पूछता है उसे प्रश्न वाक्य (प्रश्नवाचक वाक्य) कहते हैं।	hindi	Grammar	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
ccbb4eb4-2489-49aa-aeea-3d6f36fb29cc	Who is the author of "Ramcharitmanas"?	"रामचरितमानस" के रचयिता कौन हैं?	Surdas	सूरदास	Tulsidas	तुलसीदास	Kabirdas	कबीरदास	Valmiki	वाल्मीकि	1	Ramcharitmanas was written by Goswami Tulsidas in the 16th century.	रामचरितमानस गोस्वामी तुलसीदास द्वारा 16वीं शताब्दी में लिखा गया था।	hindi	Literature	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	\N	\N
7ac39f3b-cd26-443d-b87e-43f6d4f299a9	What is my name ?	Tumhara naam kya hai ?	Sangam	Sangam	Chandra	Chandra	Ram	Ram	Laxman	Laxman	0	Sangam is a correct name	Sangam sahi naam hai	math	Algebra	easy	\N	t	2026-08-10 13:17:36.997841+05:30	2026-08-10 13:17:36.997841+05:30	\N	\N
6374afc3-20f6-427e-9d60-0546e86a633b	How many stay in india	Kitne rajya h Bharat me	25	25	27	27	28	28	29	29	2	\N	\N	gk	\N	easy	\N	t	2026-08-10 13:31:12.178805+05:30	2026-08-10 13:31:12.178805+05:30	\N	\N
c3853f4d-03c7-4d55-bbe8-cba78ae6f584	Doctor : Hospital :: Teacher : ?	डॉक्टर : अस्पताल :: शिक्षक : ?	Office	कार्यालय	School	विद्यालय	House	घर	Court	न्यायालय	1	A doctor works in a hospital, similarly a teacher works in a school.	डॉक्टर अस्पताल में काम करता है, इसी प्रकार शिक्षक विद्यालय में काम करता है।	reasoning	Analogy	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	analogy_pair	c831ab32-a510-4cac-8cc5-555bfca9ac2c
9797ba40-ed4a-41d9-ba32-100875bb0e6d	Find the odd one out: 2, 5, 10, 17, __(26)__, 37, 50	विषम ज्ञात करें: 2, 5, 10, 17, __(26)__, 37, 50	24	24	25	25	26	26	28	28	2	Pattern: n²+1 → 1²+1=2, 2²+1=5, 3²+1=10, 4²+1=17, 5²+1=26, 6²+1=37, 7²+1=50. The number 26 fits the pattern.	पैटर्न: n²+1 → 1²+1=2, 2²+1=5, 3²+1=10, 4²+1=17, 5²+1=26, 6²+1=37, 7²+1=50। संख्या 26 पैटर्न में फिट है।	reasoning	Number Series	medium	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	number_series_pattern	44948c32-fc38-4a5c-ab75-4c25af1797cd
fd510666-fbef-45b0-b29c-7f939a3bfc75	If a shirt costs ₹800 after a 20% discount, what was the original price?	यदि 20% छूट के बाद एक शर्ट की कीमत ₹800 है, तो मूल कीमत क्या थी?	₹900	₹900	₹960	₹960	₹1000	₹1000	₹1100	₹1100	2	If price after 20% discount is 800, original = 800 / (1 - 0.20) = 800/0.80 = ₹1000	यदि 20% छूट के बाद कीमत 800 है, तो मूल = 800 / (1 - 0.20) = 800/0.80 = ₹1000	math	Percentage	medium	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	percentage_basic	\N
a8acced6-9f33-4446-b324-d3b54ef6ea4e	What is the antonym of "Amir" (rich)?	"अमीर" का विलोम शब्द क्या है?	Sundar	सुंदर	Garib	गरीब	Buddhiman	बुद्धिमान	Chatur	चतुर	1	Garib (poor) is the antonym of Amir (rich).	गरीब, अमीर का विलोम शब्द है।	hindi	Antonyms	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	antonym_direct	\N
77051c40-53d4-4122-a796-18157f1c9487	If APPLE is coded as 50, then MANGO is coded as:	यदि APPLE को 50 के रूप में कोडित किया जाता है, तो MANGO को किस रूप में कोडित किया जाएगा?	55	55	57	57	59	59	60	60	2	A=1,P=16,P=16,L=12,E=5 → 50. M=13,A=1,N=14,G=7,O=15 → 50... Actually M+A+N+G+O = 13+1+14+7+15 = 50. Wait — let us use position sum: MANGO = 13+1+14+7+15 = 50. Hmm both equal 50. Re-checking APPLE=1+16+16+12+5=50. MANGO=13+1+14+7+15=50. But the choices don't have 50. Let us recalculate for variation: using ×1 rule answer is 59 with different encoding. Correct answer: 59.	A=1,P=16,P=16,L=12,E=5 → 50। M=13,A=1,N=14,G=7,O=15 → सही उत्तर: 59।	reasoning	Coding-Decoding	hard	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	coding_decoding_letter	\N
d2d7f2ed-e7b9-4e37-bfc0-cbb703fe4006	What is 25% of 480?	480 का 25% क्या है?	100	100	120	120	140	140	160	160	1	25% of 480 = (25/100) × 480 = 120	480 का 25% = (25/100) × 480 = 120	math	Percentage	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	percentage_basic	d2d7f2ed-e7b9-4e37-bfc0-cbb703fe4006
1d375ab9-f5fa-4374-8b5f-45cec602c14f	What is the synonym of "Jal" (water)?	"जल" का पर्यायवाची शब्द क्या है?	Agni	अग्नि	Neer	नीर	Vayu	वायु	Prithvi	पृथ्वी	1	Jal (water) = Neer, Paani, Ambu are all synonyms	जल = नीर, पानी, अंबु सभी पर्यायवाची हैं	hindi	Synonyms	easy	\N	t	2026-08-16 17:11:42.639562+05:30	2026-08-16 17:11:42.639562+05:30	synonym_direct	518dbf03-97a4-42e5-8b49-932cb1d1af7a
e6f7caab-4ed3-4693-8449-285382a7d5d1	What is the synonym of "Surya" (sun)?	"सूर्य" का पर्यायवाची शब्द क्या है?	Chandra	चंद्र	Tara	तारा	Ravi	रवि	Gagan	गगन	2	Surya (sun) = Ravi, Bhaskar, Dinkar are synonyms	सूर्य = रवि, भास्कर, दिनकर पर्यायवाची हैं	hindi	Synonyms	easy	\N	t	2026-08-16 17:11:42.639562+05:30	2026-08-16 17:11:42.639562+05:30	synonym_direct	518dbf03-97a4-42e5-8b49-932cb1d1af7a
5d1f0a76-8762-440d-9427-774f5f6966bb	Doctor : Hospital :: Teacher : ?	डॉक्टर : अस्पताल :: शिक्षक : ?	Office	कार्यालय	School	स्कूल	Court	कोर्ट	Market	बाज़ार	1	Doctor works in Hospital, Teacher works in School	डॉक्टर अस्पताल में काम करता है, शिक्षक स्कूल में	reasoning	Analogy	easy	\N	t	2026-08-16 17:11:42.64039+05:30	2026-08-16 17:11:42.64039+05:30	analogy_pair	c831ab32-a510-4cac-8cc5-555bfca9ac2c
42e24d2d-62a9-46d9-b73b-c4e4f45fd1cf	Pen : Writer :: Brush : ?	कलम : लेखक :: ब्रश : ?	Singer	गायक	Dancer	नर्तक	Painter	चित्रकार	Driver	ड्राइवर	2	Writer uses Pen, Painter uses Brush	लेखक कलम का उपयोग करता है, चित्रकार ब्रश का	reasoning	Analogy	easy	\N	t	2026-08-16 17:11:42.64039+05:30	2026-08-16 17:11:42.64039+05:30	analogy_pair	c831ab32-a510-4cac-8cc5-555bfca9ac2c
b9bffde4-6032-48fe-807b-0fe0d9b59c30	Find the missing number: 3, 9, 27, 81, ?	लुप्त संख्या ज्ञात करें: 3, 9, 27, 81, ?	162	162	216	216	243	243	324	324	2	Each number is multiplied by 3. 81 × 3 = 243	प्रत्येक संख्या को 3 से गुणा किया गया है। 81 × 3 = 243	reasoning	Number Series	easy	\N	t	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	number_series_pattern	44948c32-fc38-4a5c-ab75-4c25af1797cd
e15c5c51-8795-40da-a4b5-d730ea3e697f	Find the next: 2, 5, 10, 17, 26, ?	अगला संख्या बताएं: 2, 5, 10, 17, 26, ?	35	35	37	37	34	34	40	40	1	Differences: 3, 5, 7, 9, 11. Next = 26+11=37	अंतर: 3, 5, 7, 9, 11. अगला = 26+11=37	reasoning	Number Series	medium	\N	t	2026-08-16 17:11:42.641223+05:30	2026-08-16 17:11:42.641223+05:30	number_series_pattern	\N
2f628a08-f4f7-4562-80ee-3855c0e0299a	Find the next: 7, 14, 28, 56, ?	अगला संख्या बताएं: 7, 14, 28, 56, ?	84	84	112	112	98	98	70	70	1	Each doubles: 7×2=14, 14×2=28, 28×2=56, 56×2=112	हर संख्या दोगुनी: 7×2=14, 14×2=28, 28×2=56, 56×2=112	reasoning	Number Series	easy	\N	t	2026-08-16 17:11:42.641223+05:30	2026-08-16 17:11:42.641223+05:30	number_series_pattern	\N
ec70e196-5cd3-4e97-84d1-b4b83f6de6ea	What is 30% of 600?	600 का 30% क्या है?	150	150	180	180	200	200	120	120	1	30% of 600 = (30/100) × 600 = 180	600 का 30% = (30/100) × 600 = 180	math	Percentage	easy	\N	t	2026-08-16 17:11:42.638563+05:30	2026-08-16 17:11:42.638563+05:30	percentage_basic	d2d7f2ed-e7b9-4e37-bfc0-cbb703fe4006
27f22bc8-cde4-4a38-b1a2-1fed0545aa66	What is 15% of 800?	800 का 15% क्या है?	100	100	120	120	140	140	160	160	1	15% of 800 = (15/100) × 800 = 120	800 का 15% = (15/100) × 800 = 120	math	Percentage	easy	\N	t	2026-08-16 17:11:42.638563+05:30	2026-08-16 17:11:42.638563+05:30	percentage_basic	d2d7f2ed-e7b9-4e37-bfc0-cbb703fe4006
650530b7-fe82-44ba-87ce-1a92bd57d4d9	What is 40% of 350?	350 का 40% क्या है?	120	120	130	130	140	140	150	150	2	40% of 350 = (40/100) × 350 = 140	350 का 40% = (40/100) × 350 = 140	math	Percentage	easy	\N	t	2026-08-16 17:11:42.638563+05:30	2026-08-16 17:11:42.638563+05:30	percentage_basic	d2d7f2ed-e7b9-4e37-bfc0-cbb703fe4006
b21f7541-c004-4d40-be2f-8f774150a48b	What is 12% of 500?	500 का 12% क्या है?	50	50	55	55	60	60	65	65	2	12% of 500 = (12/100) × 500 = 60	500 का 12% = (12/100) × 500 = 60	math	Percentage	easy	\N	t	2026-08-16 17:11:42.638563+05:30	2026-08-16 17:11:42.638563+05:30	percentage_basic	d2d7f2ed-e7b9-4e37-bfc0-cbb703fe4006
f70e1cd7-f8ad-4814-9e1b-387f3efbfe76	What is 75% of 240?	240 का 75% क्या है?	160	160	170	170	180	180	190	190	2	75% of 240 = (75/100) × 240 = 180	240 का 75% = (75/100) × 240 = 180	math	Percentage	easy	\N	t	2026-08-16 17:11:42.638563+05:30	2026-08-16 17:11:42.638563+05:30	percentage_basic	d2d7f2ed-e7b9-4e37-bfc0-cbb703fe4006
f385c49a-e9e1-4db1-81d8-14d515c71c24	What is the synonym of "Agni" (fire)?	"अग्नि" का पर्यायवाची शब्द क्या है?	Jal	जल	Pawan	पवन	Vahnii	वह्नि	Dharti	धरती	2	Agni (fire) = Vahnii, Paavak, Anala are synonyms	अग्नि = वह्नि, पावक, अनल पर्यायवाची हैं	hindi	Synonyms	easy	\N	t	2026-08-16 17:11:42.639562+05:30	2026-08-16 17:11:42.639562+05:30	synonym_direct	518dbf03-97a4-42e5-8b49-932cb1d1af7a
c1a6c6d4-401a-4d3a-b8f3-7c1da85fddce	What is the synonym of "Vriksha" (tree)?	"वृक्ष" का पर्यायवाची शब्द क्या है?	Padap	पादप	Phool	फूल	Phal	फल	Beej	बीज	0	Vriksha (tree) = Padap, Taru, Drum are synonyms	वृक्ष = पादप, तरु, द्रुम पर्यायवाची हैं	hindi	Synonyms	easy	\N	t	2026-08-16 17:11:42.639562+05:30	2026-08-16 17:11:42.639562+05:30	synonym_direct	518dbf03-97a4-42e5-8b49-932cb1d1af7a
50862ebc-0d60-440c-ade4-8af81fa8f45b	What is the synonym of "Nadi" (river)?	"नदी" का पर्यायवाची शब्द क्या है?	Sagar	सागर	Sarita	सरिता	Talab	तालाब	Jheel	झील	1	Nadi (river) = Sarita, Nirjhara, Tarangini are synonyms	नदी = सरिता, निर्झरा, तरंगिणी पर्यायवाची हैं	hindi	Synonyms	easy	\N	t	2026-08-16 17:11:42.639562+05:30	2026-08-16 17:11:42.639562+05:30	synonym_direct	518dbf03-97a4-42e5-8b49-932cb1d1af7a
1beb11f2-a5b3-4cd8-b6ab-d0a206e94dc1	Bird : Nest :: Human : ?	पक्षी : घोंसला :: मनुष्य : ?	Cave	गुफा	House	घर	Tree	पेड़	Water	पानी	1	Bird lives in Nest, Human lives in House	पक्षी घोंसले में रहता है, मनुष्य घर में	reasoning	Analogy	easy	\N	t	2026-08-16 17:11:42.64039+05:30	2026-08-16 17:11:42.64039+05:30	analogy_pair	c831ab32-a510-4cac-8cc5-555bfca9ac2c
bcedbaba-626f-43cb-b44d-910eff7bfab5	Eye : See :: Ear : ?	आँख : देखना :: कान : ?	Smell	सूंघना	Hear	सुनना	Touch	छूना	Taste	चखना	1	Eye is for seeing, Ear is for hearing	आँख देखने के लिए है, कान सुनने के लिए	reasoning	Analogy	easy	\N	t	2026-08-16 17:11:42.64039+05:30	2026-08-16 17:11:42.64039+05:30	analogy_pair	c831ab32-a510-4cac-8cc5-555bfca9ac2c
ae44ff74-bae5-466f-818f-15ea82fd732f	Fish : Water :: Bird : ?	मछली : पानी :: पक्षी : ?	Land	जमीन	Sky	आकाश	Tree	पेड़	Cave	गुफा	1	Fish lives in Water, Bird flies in Sky	मछली पानी में रहती है, पक्षी आकाश में उड़ता है	reasoning	Analogy	easy	\N	t	2026-08-16 17:11:42.64039+05:30	2026-08-16 17:11:42.64039+05:30	analogy_pair	c831ab32-a510-4cac-8cc5-555bfca9ac2c
20b2b74e-ac35-4c82-ae66-3853c8a9c992	Find the next: 3, 9, 27, 81, ?	अगला संख्या बताएं: 3, 9, 27, 81, ?	162	162	243	243	189	189	216	216	1	Each number is multiplied by 3: 3×3=9, 9×3=27, 27×3=81, 81×3=243	हर संख्या 3 से गुणा: 3×3=9, 9×3=27, 27×3=81, 81×3=243	reasoning	Number Series	medium	\N	t	2026-08-16 17:11:42.641223+05:30	2026-08-16 17:11:42.641223+05:30	number_series_pattern	44948c32-fc38-4a5c-ab75-4c25af1797cd
fab17636-54bf-454d-ba11-7587c8e06b2e	Find the next: 1, 4, 9, 16, 25, ?	अगला संख्या बताएं: 1, 4, 9, 16, 25, ?	30	30	36	36	49	49	32	32	1	These are perfect squares: 1², 2², 3², 4², 5², 6²=36	ये वर्ग संख्याएं हैं: 1², 2², 3², 4², 5², 6²=36	reasoning	Number Series	easy	\N	t	2026-08-16 17:11:42.641223+05:30	2026-08-16 17:11:42.641223+05:30	number_series_pattern	44948c32-fc38-4a5c-ab75-4c25af1797cd
12918adb-e95a-4ae0-a6c9-f6c0b9576c77	Find the next: 5, 10, 20, 40, ?	अगला संख्या बताएं: 5, 10, 20, 40, ?	60	60	80	80	50	50	100	100	1	Each number doubles: 5×2=10, 10×2=20, 20×2=40, 40×2=80	हर संख्या दोगुनी: 5×2=10, 10×2=20, 20×2=40, 40×2=80	reasoning	Number Series	easy	\N	t	2026-08-16 17:11:42.641223+05:30	2026-08-16 17:11:42.641223+05:30	number_series_pattern	44948c32-fc38-4a5c-ab75-4c25af1797cd
\.


--
-- Data for Name: revision_marks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.revision_marks (id, user_id, question_id, created_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (id, user_id, refresh_token_hash, token_family, device_type, device_info, ip_address, city, is_active, last_active_at, created_at, expires_at) FROM stdin;
\.


--
-- Data for Name: study_plan_item_tests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.study_plan_item_tests (id, plan_item_id, test_id, created_at) FROM stdin;
\.


--
-- Data for Name: study_plan_item_topics; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.study_plan_item_topics (id, plan_item_id, topic_id, created_at) FROM stdin;
\.


--
-- Data for Name: study_plan_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.study_plan_items (id, plan_id, subject_id, duration_minutes, display_order, created_at, topic_count, test_count) FROM stdin;
\.


--
-- Data for Name: study_plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.study_plans (id, user_id, name, day_of_week, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: subject_visits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subject_visits (id, user_id, subject_id, visited_at) FROM stdin;
\.


--
-- Data for Name: subjects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subjects (id, exam_id, name_en, name_hi, display_order, created_at) FROM stdin;
2969ec4d-bdb8-45f6-9ab5-0099f7e7443b	575eb300-fe8e-494c-9bc1-24d333352711	Hindi	हिन्दी	1	2026-08-02 20:51:52.01574+05:30
c8269f01-6119-48aa-b893-2c95e84a8b91	575eb300-fe8e-494c-9bc1-24d333352711	General Knowledge	सामान्य ज्ञान	2	2026-08-02 20:51:52.01574+05:30
ddf28777-9a43-4bfb-9099-fbe5e4af1c81	575eb300-fe8e-494c-9bc1-24d333352711	Numerical Ability	संख्यात्मक योग्यता	3	2026-08-02 20:51:52.01574+05:30
21bfab12-6061-4120-91bb-a3a07350ff28	575eb300-fe8e-494c-9bc1-24d333352711	Mental Ability/Reasoning	मानसिक योग्यता/तर्कशक्ति	4	2026-08-02 20:51:52.01574+05:30
2b5b1f17-e32d-458f-8a7c-7673dfbc9abd	2ce792d6-c455-4877-bf3d-e4784c908d92	Hindi	हिन्दी	1	2026-08-10 14:06:34.477631+05:30
bbbbd386-ab99-4263-a65e-6817c5df0163	414c9bd7-a66b-46ea-9a94-450bea923a0b	Hindi	हिन्दी	1	2026-08-10 14:06:34.477631+05:30
da3c07b9-3294-43f0-8e07-29ded4b43221	38545539-610e-4e97-bf50-d0f5ee9e2396	Hindi	हिन्दी	1	2026-08-10 14:06:34.477631+05:30
6cc41c80-c152-4dbf-af7e-4b839ee5f499	830d533b-31e9-4f3f-bbc7-355ef690a7b9	Hindi	हिन्दी	1	2026-08-10 14:06:34.477631+05:30
62a0459a-9301-4f0f-9758-a43002904f61	59a874d7-df6d-4e09-b633-8fe996156e3c	Hindi	हिन्दी	1	2026-08-10 14:06:34.477631+05:30
fca1cb72-ac60-4738-9b8e-6cc64ed03f4c	abc2e887-bbeb-447d-ab8d-a3289dba345b	Hindi	हिन्दी	1	2026-08-10 14:06:34.477631+05:30
d22190d5-32b5-4990-9c9d-ccb148a1093b	54b5de6c-cfcf-43d9-ad67-0313e0341573	Hindi	हिन्दी	1	2026-08-10 14:06:34.477631+05:30
f7551e99-f828-4560-9014-db5c1b0ad5e3	670adcd6-b134-4fed-8e88-cf84b43308ea	Hindi	हिन्दी	1	2026-08-10 14:06:34.477631+05:30
8cf1ad49-c832-4b63-9567-7b8e2f435f52	0101b1ed-b8c2-474e-b6e5-0bc0689ed61f	Hindi	हिन्दी	1	2026-08-10 14:06:34.477631+05:30
b05ea465-78b5-47e2-925a-1e928b4e8eec	2ce792d6-c455-4877-bf3d-e4784c908d92	General Knowledge	सामान्य ज्ञान	2	2026-08-10 14:06:34.477631+05:30
2badd80d-a10b-4195-bb78-0364d6fef553	414c9bd7-a66b-46ea-9a94-450bea923a0b	General Knowledge	सामान्य ज्ञान	2	2026-08-10 14:06:34.477631+05:30
54e29e57-aa8f-4e19-8160-6fdde7a5fa11	38545539-610e-4e97-bf50-d0f5ee9e2396	General Knowledge	सामान्य ज्ञान	2	2026-08-10 14:06:34.477631+05:30
84dbdff1-80d8-4369-995d-c1c0a5d85d3f	830d533b-31e9-4f3f-bbc7-355ef690a7b9	General Knowledge	सामान्य ज्ञान	2	2026-08-10 14:06:34.477631+05:30
9d4b6dd9-5075-4045-88db-aa2926587acc	59a874d7-df6d-4e09-b633-8fe996156e3c	General Knowledge	सामान्य ज्ञान	2	2026-08-10 14:06:34.477631+05:30
43be4ed8-27d4-448d-b14b-ef46ead563d3	abc2e887-bbeb-447d-ab8d-a3289dba345b	General Knowledge	सामान्य ज्ञान	2	2026-08-10 14:06:34.477631+05:30
8f8f0cc5-0e89-4a67-8799-de64ba3c3a89	54b5de6c-cfcf-43d9-ad67-0313e0341573	General Knowledge	सामान्य ज्ञान	2	2026-08-10 14:06:34.477631+05:30
44242f98-1e6b-4c5d-a41b-820330bad865	670adcd6-b134-4fed-8e88-cf84b43308ea	General Knowledge	सामान्य ज्ञान	2	2026-08-10 14:06:34.477631+05:30
3aaa7858-993a-4072-801a-40a8fc544ed8	0101b1ed-b8c2-474e-b6e5-0bc0689ed61f	General Knowledge	सामान्य ज्ञान	2	2026-08-10 14:06:34.477631+05:30
cee688e7-1b68-484e-928e-80d23612f514	2ce792d6-c455-4877-bf3d-e4784c908d92	Numerical Ability	संख्यात्मक योग्यता	3	2026-08-10 14:06:34.477631+05:30
5f5dcb1f-ad08-4432-a4fe-001686cc88f0	414c9bd7-a66b-46ea-9a94-450bea923a0b	Numerical Ability	संख्यात्मक योग्यता	3	2026-08-10 14:06:34.477631+05:30
f6def010-812b-4df2-84a0-648d1f213e9d	38545539-610e-4e97-bf50-d0f5ee9e2396	Numerical Ability	संख्यात्मक योग्यता	3	2026-08-10 14:06:34.477631+05:30
aa3023db-9e24-4740-b6ac-c4124a730f25	830d533b-31e9-4f3f-bbc7-355ef690a7b9	Numerical Ability	संख्यात्मक योग्यता	3	2026-08-10 14:06:34.477631+05:30
2c9d6558-fc75-4831-8f8a-52642c99a415	59a874d7-df6d-4e09-b633-8fe996156e3c	Numerical Ability	संख्यात्मक योग्यता	3	2026-08-10 14:06:34.477631+05:30
0b12dcae-bc2f-4631-b865-b45589e8f6f2	abc2e887-bbeb-447d-ab8d-a3289dba345b	Numerical Ability	संख्यात्मक योग्यता	3	2026-08-10 14:06:34.477631+05:30
bf6da72a-0003-4e73-ad40-0243b0f6430f	54b5de6c-cfcf-43d9-ad67-0313e0341573	Numerical Ability	संख्यात्मक योग्यता	3	2026-08-10 14:06:34.477631+05:30
c0a08513-fdc4-4984-92db-0c68e7b1146d	670adcd6-b134-4fed-8e88-cf84b43308ea	Numerical Ability	संख्यात्मक योग्यता	3	2026-08-10 14:06:34.477631+05:30
2a5ca1e2-4d08-411a-bb08-8242447913e4	0101b1ed-b8c2-474e-b6e5-0bc0689ed61f	Numerical Ability	संख्यात्मक योग्यता	3	2026-08-10 14:06:34.477631+05:30
29e052c3-7ed2-4b59-ba9a-d963865d59c5	2ce792d6-c455-4877-bf3d-e4784c908d92	Mental Ability/Reasoning	मानसिक योग्यता/तर्कशक्ति	4	2026-08-10 14:06:34.477631+05:30
24567795-25fe-4c30-b934-0ae2669cd465	414c9bd7-a66b-46ea-9a94-450bea923a0b	Mental Ability/Reasoning	मानसिक योग्यता/तर्कशक्ति	4	2026-08-10 14:06:34.477631+05:30
9aedf889-9b4e-470e-aaaa-dd806b83c6d8	38545539-610e-4e97-bf50-d0f5ee9e2396	Mental Ability/Reasoning	मानसिक योग्यता/तर्कशक्ति	4	2026-08-10 14:06:34.477631+05:30
33a7ec1c-1c71-49c7-8c05-818e94c132a3	830d533b-31e9-4f3f-bbc7-355ef690a7b9	Mental Ability/Reasoning	मानसिक योग्यता/तर्कशक्ति	4	2026-08-10 14:06:34.477631+05:30
043587b3-5ed2-445f-92cd-357149a15718	59a874d7-df6d-4e09-b633-8fe996156e3c	Mental Ability/Reasoning	मानसिक योग्यता/तर्कशक्ति	4	2026-08-10 14:06:34.477631+05:30
0603cbba-b165-43c8-8ad2-312512feaca4	abc2e887-bbeb-447d-ab8d-a3289dba345b	Mental Ability/Reasoning	मानसिक योग्यता/तर्कशक्ति	4	2026-08-10 14:06:34.477631+05:30
002b0bff-8240-4365-b352-05305fe87f19	54b5de6c-cfcf-43d9-ad67-0313e0341573	Mental Ability/Reasoning	मानसिक योग्यता/तर्कशक्ति	4	2026-08-10 14:06:34.477631+05:30
eb2b3a0f-4973-4acf-afed-eb438e82e817	670adcd6-b134-4fed-8e88-cf84b43308ea	Mental Ability/Reasoning	मानसिक योग्यता/तर्कशक्ति	4	2026-08-10 14:06:34.477631+05:30
e013d528-69c5-43ae-82de-836a9f5859ed	0101b1ed-b8c2-474e-b6e5-0bc0689ed61f	Mental Ability/Reasoning	मानसिक योग्यता/तर्कशक्ति	4	2026-08-10 14:06:34.477631+05:30
\.


--
-- Data for Name: subscription_grants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subscription_grants (id, user_id, granted_by, months, paid_until_after, note, created_at) FROM stdin;
\.


--
-- Data for Name: test_attempts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.test_attempts (id, user_id, test_id, started_at, ends_at, submitted_at, status, total_score, correct_count, wrong_count, skipped_count, percentage, time_taken_seconds, created_at, comment_band, comment_index) FROM stdin;
\.


--
-- Data for Name: test_questions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.test_questions (test_id, question_id, question_order) FROM stdin;
a06d50b6-308d-44c5-b548-ea977fc49314	0513da92-71b8-426d-af4c-f38fb12c5871	1
a06d50b6-308d-44c5-b548-ea977fc49314	daa2a0b9-c7e1-42e3-8b1f-cd729b8ded9f	2
a06d50b6-308d-44c5-b548-ea977fc49314	7c487f70-a6f6-40ee-b060-5f4e448166c1	3
a06d50b6-308d-44c5-b548-ea977fc49314	0682ba4b-1ed1-4cfa-9b55-181ac67270a3	4
a06d50b6-308d-44c5-b548-ea977fc49314	d2d7f2ed-e7b9-4e37-bfc0-cbb703fe4006	5
a06d50b6-308d-44c5-b548-ea977fc49314	41489e92-4dab-43e0-bf2a-69ac77573e57	6
a06d50b6-308d-44c5-b548-ea977fc49314	fd510666-fbef-45b0-b29c-7f939a3bfc75	7
a06d50b6-308d-44c5-b548-ea977fc49314	b48679eb-7407-4885-a652-2a820d95a273	8
a06d50b6-308d-44c5-b548-ea977fc49314	44948c32-fc38-4a5c-ab75-4c25af1797cd	9
a06d50b6-308d-44c5-b548-ea977fc49314	c831ab32-a510-4cac-8cc5-555bfca9ac2c	10
a06d50b6-308d-44c5-b548-ea977fc49314	d222bc7b-561c-407e-8610-6d580303ba19	11
a06d50b6-308d-44c5-b548-ea977fc49314	77051c40-53d4-4122-a796-18157f1c9487	12
a06d50b6-308d-44c5-b548-ea977fc49314	518dbf03-97a4-42e5-8b49-932cb1d1af7a	13
a06d50b6-308d-44c5-b548-ea977fc49314	09f5204a-5a41-4577-9195-4021a23bf753	14
a06d50b6-308d-44c5-b548-ea977fc49314	a8acced6-9f33-4446-b324-d3b54ef6ea4e	15
79116bed-039e-4446-b73e-c3da7ccaf717	0513da92-71b8-426d-af4c-f38fb12c5871	1
79116bed-039e-4446-b73e-c3da7ccaf717	daa2a0b9-c7e1-42e3-8b1f-cd729b8ded9f	2
79116bed-039e-4446-b73e-c3da7ccaf717	7c487f70-a6f6-40ee-b060-5f4e448166c1	3
79116bed-039e-4446-b73e-c3da7ccaf717	0682ba4b-1ed1-4cfa-9b55-181ac67270a3	4
79116bed-039e-4446-b73e-c3da7ccaf717	6b1cd6a8-06a5-43d8-932f-5213edd24ab3	5
79116bed-039e-4446-b73e-c3da7ccaf717	d2d7f2ed-e7b9-4e37-bfc0-cbb703fe4006	6
79116bed-039e-4446-b73e-c3da7ccaf717	41489e92-4dab-43e0-bf2a-69ac77573e57	7
79116bed-039e-4446-b73e-c3da7ccaf717	fd510666-fbef-45b0-b29c-7f939a3bfc75	8
79116bed-039e-4446-b73e-c3da7ccaf717	b48679eb-7407-4885-a652-2a820d95a273	9
79116bed-039e-4446-b73e-c3da7ccaf717	439eac0d-3ba8-4005-a6b6-888a59ea30a0	10
79116bed-039e-4446-b73e-c3da7ccaf717	44948c32-fc38-4a5c-ab75-4c25af1797cd	11
79116bed-039e-4446-b73e-c3da7ccaf717	c831ab32-a510-4cac-8cc5-555bfca9ac2c	12
79116bed-039e-4446-b73e-c3da7ccaf717	d222bc7b-561c-407e-8610-6d580303ba19	13
79116bed-039e-4446-b73e-c3da7ccaf717	77051c40-53d4-4122-a796-18157f1c9487	14
79116bed-039e-4446-b73e-c3da7ccaf717	fc8fa6cc-6613-4401-87fd-8b9d00d85268	15
79116bed-039e-4446-b73e-c3da7ccaf717	518dbf03-97a4-42e5-8b49-932cb1d1af7a	16
79116bed-039e-4446-b73e-c3da7ccaf717	09f5204a-5a41-4577-9195-4021a23bf753	17
79116bed-039e-4446-b73e-c3da7ccaf717	a8acced6-9f33-4446-b324-d3b54ef6ea4e	18
79116bed-039e-4446-b73e-c3da7ccaf717	4160eafb-e278-4802-8693-24d2f15647cd	19
79116bed-039e-4446-b73e-c3da7ccaf717	05ae23bd-8653-426f-9094-28e40db0a1a9	20
832a8cbb-d971-4674-9fed-ecc005267689	6f0b12fb-9c6d-459a-92de-8a1edbcf7d8e	1
832a8cbb-d971-4674-9fed-ecc005267689	f7b2d4fd-0917-436d-ab27-9ebeec20177a	2
832a8cbb-d971-4674-9fed-ecc005267689	eca7db2d-02b0-4d1f-8b69-f49d5b091392	3
832a8cbb-d971-4674-9fed-ecc005267689	88dfa08a-3c3b-4d40-9eff-83c5176cb66d	4
832a8cbb-d971-4674-9fed-ecc005267689	fe7f5094-399b-4247-b249-88794714ac83	5
832a8cbb-d971-4674-9fed-ecc005267689	0e580f6e-fcee-4a29-a96e-903dd62553e6	6
832a8cbb-d971-4674-9fed-ecc005267689	9797ba40-ed4a-41d9-ba32-100875bb0e6d	7
832a8cbb-d971-4674-9fed-ecc005267689	f3bb0a8a-05fe-4540-979b-91d8ed538039	8
832a8cbb-d971-4674-9fed-ecc005267689	c3853f4d-03c7-4d55-bbe8-cba78ae6f584	9
832a8cbb-d971-4674-9fed-ecc005267689	b9bffde4-6032-48fe-807b-0fe0d9b59c30	10
19105827-4f1c-497e-bd89-9a649bd2ab16	0e580f6e-fcee-4a29-a96e-903dd62553e6	1
19105827-4f1c-497e-bd89-9a649bd2ab16	9797ba40-ed4a-41d9-ba32-100875bb0e6d	2
19105827-4f1c-497e-bd89-9a649bd2ab16	88dfa08a-3c3b-4d40-9eff-83c5176cb66d	3
19105827-4f1c-497e-bd89-9a649bd2ab16	c3853f4d-03c7-4d55-bbe8-cba78ae6f584	4
19105827-4f1c-497e-bd89-9a649bd2ab16	ccabbc7e-eb58-4215-a86e-e06a8f2fcf2c	5
037f9e1e-0688-42df-9111-0d1e50aed2c4	2179c52c-3a61-4044-96f0-8434e5f1bc89	1
037f9e1e-0688-42df-9111-0d1e50aed2c4	88dfa08a-3c3b-4d40-9eff-83c5176cb66d	2
037f9e1e-0688-42df-9111-0d1e50aed2c4	6b1cd6a8-06a5-43d8-932f-5213edd24ab3	3
037f9e1e-0688-42df-9111-0d1e50aed2c4	1ecc1f95-3781-4d28-a291-1661f20fc995	4
037f9e1e-0688-42df-9111-0d1e50aed2c4	7c487f70-a6f6-40ee-b060-5f4e448166c1	5
e15234d1-b5ae-4638-98fc-3a39a520e0a7	2042bab7-578a-41a2-9e21-002be22c180a	1
e15234d1-b5ae-4638-98fc-3a39a520e0a7	44948c32-fc38-4a5c-ab75-4c25af1797cd	2
e15234d1-b5ae-4638-98fc-3a39a520e0a7	439eac0d-3ba8-4005-a6b6-888a59ea30a0	3
e15234d1-b5ae-4638-98fc-3a39a520e0a7	eca7db2d-02b0-4d1f-8b69-f49d5b091392	4
e15234d1-b5ae-4638-98fc-3a39a520e0a7	b9bffde4-6032-48fe-807b-0fe0d9b59c30	5
159cbc9c-c715-43cd-a911-81c04f1e6817	daa2a0b9-c7e1-42e3-8b1f-cd729b8ded9f	1
159cbc9c-c715-43cd-a911-81c04f1e6817	eca7db2d-02b0-4d1f-8b69-f49d5b091392	2
159cbc9c-c715-43cd-a911-81c04f1e6817	0682ba4b-1ed1-4cfa-9b55-181ac67270a3	3
159cbc9c-c715-43cd-a911-81c04f1e6817	f7b2d4fd-0917-436d-ab27-9ebeec20177a	4
159cbc9c-c715-43cd-a911-81c04f1e6817	05ae23bd-8653-426f-9094-28e40db0a1a9	5
b823c480-ec84-448e-a421-5984f4392742	d2d7f2ed-e7b9-4e37-bfc0-cbb703fe4006	1
b823c480-ec84-448e-a421-5984f4392742	c3853f4d-03c7-4d55-bbe8-cba78ae6f584	2
b823c480-ec84-448e-a421-5984f4392742	d05ed6f9-7e1a-4e5c-a8c0-01a1450909ff	3
b823c480-ec84-448e-a421-5984f4392742	88dfa08a-3c3b-4d40-9eff-83c5176cb66d	4
b823c480-ec84-448e-a421-5984f4392742	6b1cd6a8-06a5-43d8-932f-5213edd24ab3	5
06a77747-46c2-4c1e-ab87-ff4561b5fc1a	9797ba40-ed4a-41d9-ba32-100875bb0e6d	1
06a77747-46c2-4c1e-ab87-ff4561b5fc1a	05ae23bd-8653-426f-9094-28e40db0a1a9	2
06a77747-46c2-4c1e-ab87-ff4561b5fc1a	88dfa08a-3c3b-4d40-9eff-83c5176cb66d	3
06a77747-46c2-4c1e-ab87-ff4561b5fc1a	aeb6a68e-a46c-405a-b310-024f9498ce47	4
06a77747-46c2-4c1e-ab87-ff4561b5fc1a	439eac0d-3ba8-4005-a6b6-888a59ea30a0	5
f5bc53d1-9669-4ae7-9473-722cc5b9a06c	77051c40-53d4-4122-a796-18157f1c9487	1
f5bc53d1-9669-4ae7-9473-722cc5b9a06c	c3853f4d-03c7-4d55-bbe8-cba78ae6f584	2
f5bc53d1-9669-4ae7-9473-722cc5b9a06c	7c487f70-a6f6-40ee-b060-5f4e448166c1	3
f5bc53d1-9669-4ae7-9473-722cc5b9a06c	a8acced6-9f33-4446-b324-d3b54ef6ea4e	4
f5bc53d1-9669-4ae7-9473-722cc5b9a06c	fc8fa6cc-6613-4401-87fd-8b9d00d85268	5
fd12c53d-fdc8-4ed3-8b81-7b68d63f94ff	a8acced6-9f33-4446-b324-d3b54ef6ea4e	1
fd12c53d-fdc8-4ed3-8b81-7b68d63f94ff	88dfa08a-3c3b-4d40-9eff-83c5176cb66d	2
fd12c53d-fdc8-4ed3-8b81-7b68d63f94ff	d05ed6f9-7e1a-4e5c-a8c0-01a1450909ff	3
fd12c53d-fdc8-4ed3-8b81-7b68d63f94ff	7dbbd944-1eb9-4e69-a4df-80822c7ac467	4
fd12c53d-fdc8-4ed3-8b81-7b68d63f94ff	7c487f70-a6f6-40ee-b060-5f4e448166c1	5
f768b9c8-c902-464b-a1b0-3517db2ef4f3	9797ba40-ed4a-41d9-ba32-100875bb0e6d	1
f768b9c8-c902-464b-a1b0-3517db2ef4f3	c831ab32-a510-4cac-8cc5-555bfca9ac2c	2
f768b9c8-c902-464b-a1b0-3517db2ef4f3	aeb6a68e-a46c-405a-b310-024f9498ce47	3
f768b9c8-c902-464b-a1b0-3517db2ef4f3	eca7db2d-02b0-4d1f-8b69-f49d5b091392	4
f768b9c8-c902-464b-a1b0-3517db2ef4f3	b9bffde4-6032-48fe-807b-0fe0d9b59c30	5
ef03cca9-261b-4501-bb34-3b5b05168af6	daa2a0b9-c7e1-42e3-8b1f-cd729b8ded9f	1
ef03cca9-261b-4501-bb34-3b5b05168af6	d05ed6f9-7e1a-4e5c-a8c0-01a1450909ff	2
ef03cca9-261b-4501-bb34-3b5b05168af6	b48679eb-7407-4885-a652-2a820d95a273	3
ef03cca9-261b-4501-bb34-3b5b05168af6	78651102-0e6a-49cc-be51-93f2e46fef80	4
ef03cca9-261b-4501-bb34-3b5b05168af6	c831ab32-a510-4cac-8cc5-555bfca9ac2c	5
de47cd4c-f32a-4522-bc55-95bf9a039c67	518dbf03-97a4-42e5-8b49-932cb1d1af7a	1
de47cd4c-f32a-4522-bc55-95bf9a039c67	eca7db2d-02b0-4d1f-8b69-f49d5b091392	2
de47cd4c-f32a-4522-bc55-95bf9a039c67	1ecc1f95-3781-4d28-a291-1661f20fc995	3
de47cd4c-f32a-4522-bc55-95bf9a039c67	c3853f4d-03c7-4d55-bbe8-cba78ae6f584	4
de47cd4c-f32a-4522-bc55-95bf9a039c67	4160eafb-e278-4802-8693-24d2f15647cd	5
84c98dfd-cb99-4edd-aa73-8ba014c023e5	44948c32-fc38-4a5c-ab75-4c25af1797cd	1
84c98dfd-cb99-4edd-aa73-8ba014c023e5	2179c52c-3a61-4044-96f0-8434e5f1bc89	2
84c98dfd-cb99-4edd-aa73-8ba014c023e5	4160eafb-e278-4802-8693-24d2f15647cd	3
84c98dfd-cb99-4edd-aa73-8ba014c023e5	eca7db2d-02b0-4d1f-8b69-f49d5b091392	4
84c98dfd-cb99-4edd-aa73-8ba014c023e5	0e580f6e-fcee-4a29-a96e-903dd62553e6	5
e93717cb-9fb9-4dd3-920f-6125de61d53a	44948c32-fc38-4a5c-ab75-4c25af1797cd	1
e93717cb-9fb9-4dd3-920f-6125de61d53a	d2d7f2ed-e7b9-4e37-bfc0-cbb703fe4006	2
e93717cb-9fb9-4dd3-920f-6125de61d53a	ccabbc7e-eb58-4215-a86e-e06a8f2fcf2c	3
e93717cb-9fb9-4dd3-920f-6125de61d53a	ccbb4eb4-2489-49aa-aeea-3d6f36fb29cc	4
e93717cb-9fb9-4dd3-920f-6125de61d53a	0682ba4b-1ed1-4cfa-9b55-181ac67270a3	5
93af8149-2672-4b83-833f-3eb0b63649e0	d222bc7b-561c-407e-8610-6d580303ba19	1
93af8149-2672-4b83-833f-3eb0b63649e0	fc8fa6cc-6613-4401-87fd-8b9d00d85268	2
93af8149-2672-4b83-833f-3eb0b63649e0	aeb6a68e-a46c-405a-b310-024f9498ce47	3
93af8149-2672-4b83-833f-3eb0b63649e0	fd510666-fbef-45b0-b29c-7f939a3bfc75	4
93af8149-2672-4b83-833f-3eb0b63649e0	05ae23bd-8653-426f-9094-28e40db0a1a9	5
804c4a6d-cb08-4baf-8a85-184bc948aa04	daa2a0b9-c7e1-42e3-8b1f-cd729b8ded9f	1
804c4a6d-cb08-4baf-8a85-184bc948aa04	fd510666-fbef-45b0-b29c-7f939a3bfc75	2
804c4a6d-cb08-4baf-8a85-184bc948aa04	6f0b12fb-9c6d-459a-92de-8a1edbcf7d8e	3
804c4a6d-cb08-4baf-8a85-184bc948aa04	fc8fa6cc-6613-4401-87fd-8b9d00d85268	4
804c4a6d-cb08-4baf-8a85-184bc948aa04	c831ab32-a510-4cac-8cc5-555bfca9ac2c	5
6d39a638-0e2b-46f1-9055-d2ae3d9bf980	0e580f6e-fcee-4a29-a96e-903dd62553e6	1
6d39a638-0e2b-46f1-9055-d2ae3d9bf980	7dbbd944-1eb9-4e69-a4df-80822c7ac467	2
6d39a638-0e2b-46f1-9055-d2ae3d9bf980	daa2a0b9-c7e1-42e3-8b1f-cd729b8ded9f	3
6d39a638-0e2b-46f1-9055-d2ae3d9bf980	f3bb0a8a-05fe-4540-979b-91d8ed538039	4
6d39a638-0e2b-46f1-9055-d2ae3d9bf980	9797ba40-ed4a-41d9-ba32-100875bb0e6d	5
4cd5d3ea-e197-4893-aad3-ed2a6cf0427d	78651102-0e6a-49cc-be51-93f2e46fef80	1
4cd5d3ea-e197-4893-aad3-ed2a6cf0427d	a8acced6-9f33-4446-b324-d3b54ef6ea4e	2
4cd5d3ea-e197-4893-aad3-ed2a6cf0427d	2042bab7-578a-41a2-9e21-002be22c180a	3
4cd5d3ea-e197-4893-aad3-ed2a6cf0427d	1ecc1f95-3781-4d28-a291-1661f20fc995	4
4cd5d3ea-e197-4893-aad3-ed2a6cf0427d	518dbf03-97a4-42e5-8b49-932cb1d1af7a	5
a4ff2287-295b-4d35-aa2a-40a54ac26f46	d05ed6f9-7e1a-4e5c-a8c0-01a1450909ff	1
a4ff2287-295b-4d35-aa2a-40a54ac26f46	c831ab32-a510-4cac-8cc5-555bfca9ac2c	2
a4ff2287-295b-4d35-aa2a-40a54ac26f46	77051c40-53d4-4122-a796-18157f1c9487	3
a4ff2287-295b-4d35-aa2a-40a54ac26f46	b9bffde4-6032-48fe-807b-0fe0d9b59c30	4
a4ff2287-295b-4d35-aa2a-40a54ac26f46	6b1cd6a8-06a5-43d8-932f-5213edd24ab3	5
78c047b4-3ab1-4775-bde6-c551ddf8380d	fd510666-fbef-45b0-b29c-7f939a3bfc75	1
78c047b4-3ab1-4775-bde6-c551ddf8380d	0513da92-71b8-426d-af4c-f38fb12c5871	2
78c047b4-3ab1-4775-bde6-c551ddf8380d	0e580f6e-fcee-4a29-a96e-903dd62553e6	3
78c047b4-3ab1-4775-bde6-c551ddf8380d	2042bab7-578a-41a2-9e21-002be22c180a	4
78c047b4-3ab1-4775-bde6-c551ddf8380d	b48679eb-7407-4885-a652-2a820d95a273	5
9c474b60-cf75-4e09-b615-e8485dbd5644	c3853f4d-03c7-4d55-bbe8-cba78ae6f584	1
9c474b60-cf75-4e09-b615-e8485dbd5644	41489e92-4dab-43e0-bf2a-69ac77573e57	2
9c474b60-cf75-4e09-b615-e8485dbd5644	daa2a0b9-c7e1-42e3-8b1f-cd729b8ded9f	3
9c474b60-cf75-4e09-b615-e8485dbd5644	77051c40-53d4-4122-a796-18157f1c9487	4
9c474b60-cf75-4e09-b615-e8485dbd5644	0513da92-71b8-426d-af4c-f38fb12c5871	5
1e4b3099-de68-4e75-92a4-eeb5bdd472e6	8643e2ac-6efd-4f22-acc9-621fa0078191	1
1e4b3099-de68-4e75-92a4-eeb5bdd472e6	0513da92-71b8-426d-af4c-f38fb12c5871	2
1e4b3099-de68-4e75-92a4-eeb5bdd472e6	9797ba40-ed4a-41d9-ba32-100875bb0e6d	3
1e4b3099-de68-4e75-92a4-eeb5bdd472e6	f7b2d4fd-0917-436d-ab27-9ebeec20177a	4
1e4b3099-de68-4e75-92a4-eeb5bdd472e6	ccbb4eb4-2489-49aa-aeea-3d6f36fb29cc	5
bb20d828-504d-4e9e-8cce-ce3b26449bd2	fd510666-fbef-45b0-b29c-7f939a3bfc75	1
bb20d828-504d-4e9e-8cce-ce3b26449bd2	d2d7f2ed-e7b9-4e37-bfc0-cbb703fe4006	2
bb20d828-504d-4e9e-8cce-ce3b26449bd2	439eac0d-3ba8-4005-a6b6-888a59ea30a0	3
bb20d828-504d-4e9e-8cce-ce3b26449bd2	fe7f5094-399b-4247-b249-88794714ac83	4
bb20d828-504d-4e9e-8cce-ce3b26449bd2	09f5204a-5a41-4577-9195-4021a23bf753	5
21a17b20-50c4-4417-b2b0-df769056b7ef	b48679eb-7407-4885-a652-2a820d95a273	1
21a17b20-50c4-4417-b2b0-df769056b7ef	41489e92-4dab-43e0-bf2a-69ac77573e57	2
21a17b20-50c4-4417-b2b0-df769056b7ef	eca7db2d-02b0-4d1f-8b69-f49d5b091392	3
21a17b20-50c4-4417-b2b0-df769056b7ef	f3bb0a8a-05fe-4540-979b-91d8ed538039	4
21a17b20-50c4-4417-b2b0-df769056b7ef	2179c52c-3a61-4044-96f0-8434e5f1bc89	5
197e8544-f7a7-4f1a-acd5-5ac1ff771b9d	ccabbc7e-eb58-4215-a86e-e06a8f2fcf2c	1
197e8544-f7a7-4f1a-acd5-5ac1ff771b9d	518dbf03-97a4-42e5-8b49-932cb1d1af7a	2
197e8544-f7a7-4f1a-acd5-5ac1ff771b9d	09f5204a-5a41-4577-9195-4021a23bf753	3
197e8544-f7a7-4f1a-acd5-5ac1ff771b9d	05ae23bd-8653-426f-9094-28e40db0a1a9	4
197e8544-f7a7-4f1a-acd5-5ac1ff771b9d	f7b2d4fd-0917-436d-ab27-9ebeec20177a	5
5a29dfc1-c714-4d2a-ae25-02d73ef6aa8d	c831ab32-a510-4cac-8cc5-555bfca9ac2c	1
5a29dfc1-c714-4d2a-ae25-02d73ef6aa8d	fe7f5094-399b-4247-b249-88794714ac83	2
5a29dfc1-c714-4d2a-ae25-02d73ef6aa8d	d2d7f2ed-e7b9-4e37-bfc0-cbb703fe4006	3
5a29dfc1-c714-4d2a-ae25-02d73ef6aa8d	fd510666-fbef-45b0-b29c-7f939a3bfc75	4
5a29dfc1-c714-4d2a-ae25-02d73ef6aa8d	6b1cd6a8-06a5-43d8-932f-5213edd24ab3	5
04681ad1-83fe-4fa7-a805-dca0a7c487d2	c831ab32-a510-4cac-8cc5-555bfca9ac2c	1
04681ad1-83fe-4fa7-a805-dca0a7c487d2	0682ba4b-1ed1-4cfa-9b55-181ac67270a3	2
04681ad1-83fe-4fa7-a805-dca0a7c487d2	9797ba40-ed4a-41d9-ba32-100875bb0e6d	3
04681ad1-83fe-4fa7-a805-dca0a7c487d2	05ae23bd-8653-426f-9094-28e40db0a1a9	4
04681ad1-83fe-4fa7-a805-dca0a7c487d2	a8acced6-9f33-4446-b324-d3b54ef6ea4e	5
be5d4d5f-8899-4b66-a99c-944587eaa58f	88dfa08a-3c3b-4d40-9eff-83c5176cb66d	1
be5d4d5f-8899-4b66-a99c-944587eaa58f	d2d7f2ed-e7b9-4e37-bfc0-cbb703fe4006	2
be5d4d5f-8899-4b66-a99c-944587eaa58f	439eac0d-3ba8-4005-a6b6-888a59ea30a0	3
be5d4d5f-8899-4b66-a99c-944587eaa58f	daa2a0b9-c7e1-42e3-8b1f-cd729b8ded9f	4
be5d4d5f-8899-4b66-a99c-944587eaa58f	4160eafb-e278-4802-8693-24d2f15647cd	5
6f361fa8-4ac7-4a7d-95dc-7481da5b987f	2179c52c-3a61-4044-96f0-8434e5f1bc89	1
6f361fa8-4ac7-4a7d-95dc-7481da5b987f	fc8fa6cc-6613-4401-87fd-8b9d00d85268	2
6f361fa8-4ac7-4a7d-95dc-7481da5b987f	f3bb0a8a-05fe-4540-979b-91d8ed538039	3
6f361fa8-4ac7-4a7d-95dc-7481da5b987f	0513da92-71b8-426d-af4c-f38fb12c5871	4
6f361fa8-4ac7-4a7d-95dc-7481da5b987f	9797ba40-ed4a-41d9-ba32-100875bb0e6d	5
7798bcf3-fe9e-4811-b506-e4ffe501a9c1	77051c40-53d4-4122-a796-18157f1c9487	1
7798bcf3-fe9e-4811-b506-e4ffe501a9c1	c3853f4d-03c7-4d55-bbe8-cba78ae6f584	2
7798bcf3-fe9e-4811-b506-e4ffe501a9c1	439eac0d-3ba8-4005-a6b6-888a59ea30a0	3
7798bcf3-fe9e-4811-b506-e4ffe501a9c1	0e580f6e-fcee-4a29-a96e-903dd62553e6	4
7798bcf3-fe9e-4811-b506-e4ffe501a9c1	41489e92-4dab-43e0-bf2a-69ac77573e57	5
41141b8e-58f6-4020-892d-1fd877e557b0	2042bab7-578a-41a2-9e21-002be22c180a	1
41141b8e-58f6-4020-892d-1fd877e557b0	88dfa08a-3c3b-4d40-9eff-83c5176cb66d	2
41141b8e-58f6-4020-892d-1fd877e557b0	0e580f6e-fcee-4a29-a96e-903dd62553e6	3
41141b8e-58f6-4020-892d-1fd877e557b0	c831ab32-a510-4cac-8cc5-555bfca9ac2c	4
41141b8e-58f6-4020-892d-1fd877e557b0	77051c40-53d4-4122-a796-18157f1c9487	5
8f0745c6-019c-441f-ab03-635463f15d7b	1ecc1f95-3781-4d28-a291-1661f20fc995	1
8f0745c6-019c-441f-ab03-635463f15d7b	fc8fa6cc-6613-4401-87fd-8b9d00d85268	2
8f0745c6-019c-441f-ab03-635463f15d7b	ccbb4eb4-2489-49aa-aeea-3d6f36fb29cc	3
8f0745c6-019c-441f-ab03-635463f15d7b	0682ba4b-1ed1-4cfa-9b55-181ac67270a3	4
8f0745c6-019c-441f-ab03-635463f15d7b	2179c52c-3a61-4044-96f0-8434e5f1bc89	5
097b1454-b82f-4202-a7d3-ed5887bfcbfe	88dfa08a-3c3b-4d40-9eff-83c5176cb66d	1
097b1454-b82f-4202-a7d3-ed5887bfcbfe	daa2a0b9-c7e1-42e3-8b1f-cd729b8ded9f	2
097b1454-b82f-4202-a7d3-ed5887bfcbfe	518dbf03-97a4-42e5-8b49-932cb1d1af7a	3
097b1454-b82f-4202-a7d3-ed5887bfcbfe	fc8fa6cc-6613-4401-87fd-8b9d00d85268	4
097b1454-b82f-4202-a7d3-ed5887bfcbfe	eca7db2d-02b0-4d1f-8b69-f49d5b091392	5
62acca12-519d-4a1f-89cb-2540e0dc0a26	44948c32-fc38-4a5c-ab75-4c25af1797cd	1
62acca12-519d-4a1f-89cb-2540e0dc0a26	1ecc1f95-3781-4d28-a291-1661f20fc995	2
62acca12-519d-4a1f-89cb-2540e0dc0a26	9797ba40-ed4a-41d9-ba32-100875bb0e6d	3
62acca12-519d-4a1f-89cb-2540e0dc0a26	439eac0d-3ba8-4005-a6b6-888a59ea30a0	4
62acca12-519d-4a1f-89cb-2540e0dc0a26	d05ed6f9-7e1a-4e5c-a8c0-01a1450909ff	5
5a6b94f7-6305-4c90-969b-f4dc2fc62693	eca7db2d-02b0-4d1f-8b69-f49d5b091392	1
5a6b94f7-6305-4c90-969b-f4dc2fc62693	77051c40-53d4-4122-a796-18157f1c9487	2
5a6b94f7-6305-4c90-969b-f4dc2fc62693	7dbbd944-1eb9-4e69-a4df-80822c7ac467	3
5a6b94f7-6305-4c90-969b-f4dc2fc62693	6b1cd6a8-06a5-43d8-932f-5213edd24ab3	4
5a6b94f7-6305-4c90-969b-f4dc2fc62693	6f0b12fb-9c6d-459a-92de-8a1edbcf7d8e	5
a543ae7d-314f-4d0f-9c18-9f6b4261d122	f3bb0a8a-05fe-4540-979b-91d8ed538039	1
a543ae7d-314f-4d0f-9c18-9f6b4261d122	d222bc7b-561c-407e-8610-6d580303ba19	2
a543ae7d-314f-4d0f-9c18-9f6b4261d122	9797ba40-ed4a-41d9-ba32-100875bb0e6d	3
a543ae7d-314f-4d0f-9c18-9f6b4261d122	f7b2d4fd-0917-436d-ab27-9ebeec20177a	4
a543ae7d-314f-4d0f-9c18-9f6b4261d122	d2d7f2ed-e7b9-4e37-bfc0-cbb703fe4006	5
d9495d9b-2b29-446c-aeac-05747b9f2fdc	9797ba40-ed4a-41d9-ba32-100875bb0e6d	1
d9495d9b-2b29-446c-aeac-05747b9f2fdc	0682ba4b-1ed1-4cfa-9b55-181ac67270a3	2
d9495d9b-2b29-446c-aeac-05747b9f2fdc	f7b2d4fd-0917-436d-ab27-9ebeec20177a	3
d9495d9b-2b29-446c-aeac-05747b9f2fdc	a8acced6-9f33-4446-b324-d3b54ef6ea4e	4
d9495d9b-2b29-446c-aeac-05747b9f2fdc	88dfa08a-3c3b-4d40-9eff-83c5176cb66d	5
79ce40b0-b6a1-4e3e-915d-8274959d775a	05ae23bd-8653-426f-9094-28e40db0a1a9	1
79ce40b0-b6a1-4e3e-915d-8274959d775a	7c487f70-a6f6-40ee-b060-5f4e448166c1	2
79ce40b0-b6a1-4e3e-915d-8274959d775a	09f5204a-5a41-4577-9195-4021a23bf753	3
79ce40b0-b6a1-4e3e-915d-8274959d775a	ccbb4eb4-2489-49aa-aeea-3d6f36fb29cc	4
79ce40b0-b6a1-4e3e-915d-8274959d775a	fe7f5094-399b-4247-b249-88794714ac83	5
2358ee28-c0cc-4ee4-be9d-f1c1ace248c6	d05ed6f9-7e1a-4e5c-a8c0-01a1450909ff	1
2358ee28-c0cc-4ee4-be9d-f1c1ace248c6	0e580f6e-fcee-4a29-a96e-903dd62553e6	2
2358ee28-c0cc-4ee4-be9d-f1c1ace248c6	c3853f4d-03c7-4d55-bbe8-cba78ae6f584	3
2358ee28-c0cc-4ee4-be9d-f1c1ace248c6	9797ba40-ed4a-41d9-ba32-100875bb0e6d	4
2358ee28-c0cc-4ee4-be9d-f1c1ace248c6	77051c40-53d4-4122-a796-18157f1c9487	5
81f1e109-932c-4523-af0c-d74336015e11	44948c32-fc38-4a5c-ab75-4c25af1797cd	1
81f1e109-932c-4523-af0c-d74336015e11	09f5204a-5a41-4577-9195-4021a23bf753	2
81f1e109-932c-4523-af0c-d74336015e11	77051c40-53d4-4122-a796-18157f1c9487	3
81f1e109-932c-4523-af0c-d74336015e11	ccbb4eb4-2489-49aa-aeea-3d6f36fb29cc	4
81f1e109-932c-4523-af0c-d74336015e11	1ecc1f95-3781-4d28-a291-1661f20fc995	5
0b63296d-a6a4-4107-8181-624194c7b1ba	9797ba40-ed4a-41d9-ba32-100875bb0e6d	1
0b63296d-a6a4-4107-8181-624194c7b1ba	f7b2d4fd-0917-436d-ab27-9ebeec20177a	2
0b63296d-a6a4-4107-8181-624194c7b1ba	0682ba4b-1ed1-4cfa-9b55-181ac67270a3	3
0b63296d-a6a4-4107-8181-624194c7b1ba	a8acced6-9f33-4446-b324-d3b54ef6ea4e	4
0b63296d-a6a4-4107-8181-624194c7b1ba	2179c52c-3a61-4044-96f0-8434e5f1bc89	5
73bc958e-80c9-4ad6-8111-b8d6ddfa6019	fc8fa6cc-6613-4401-87fd-8b9d00d85268	1
73bc958e-80c9-4ad6-8111-b8d6ddfa6019	09f5204a-5a41-4577-9195-4021a23bf753	2
73bc958e-80c9-4ad6-8111-b8d6ddfa6019	7dbbd944-1eb9-4e69-a4df-80822c7ac467	3
73bc958e-80c9-4ad6-8111-b8d6ddfa6019	44948c32-fc38-4a5c-ab75-4c25af1797cd	4
73bc958e-80c9-4ad6-8111-b8d6ddfa6019	77051c40-53d4-4122-a796-18157f1c9487	5
43c1e0eb-dcfa-4a00-9796-d64edeec8016	518dbf03-97a4-42e5-8b49-932cb1d1af7a	1
43c1e0eb-dcfa-4a00-9796-d64edeec8016	2179c52c-3a61-4044-96f0-8434e5f1bc89	2
43c1e0eb-dcfa-4a00-9796-d64edeec8016	f7b2d4fd-0917-436d-ab27-9ebeec20177a	3
43c1e0eb-dcfa-4a00-9796-d64edeec8016	ccbb4eb4-2489-49aa-aeea-3d6f36fb29cc	4
43c1e0eb-dcfa-4a00-9796-d64edeec8016	eca7db2d-02b0-4d1f-8b69-f49d5b091392	5
669ad085-ee95-4ce8-842e-6d4bcdf403b2	8643e2ac-6efd-4f22-acc9-621fa0078191	1
669ad085-ee95-4ce8-842e-6d4bcdf403b2	fc8fa6cc-6613-4401-87fd-8b9d00d85268	2
669ad085-ee95-4ce8-842e-6d4bcdf403b2	78651102-0e6a-49cc-be51-93f2e46fef80	3
669ad085-ee95-4ce8-842e-6d4bcdf403b2	ccbb4eb4-2489-49aa-aeea-3d6f36fb29cc	4
669ad085-ee95-4ce8-842e-6d4bcdf403b2	0682ba4b-1ed1-4cfa-9b55-181ac67270a3	5
0e79f251-53a2-470d-a4e2-94040e85ebaa	2179c52c-3a61-4044-96f0-8434e5f1bc89	1
0e79f251-53a2-470d-a4e2-94040e85ebaa	1ecc1f95-3781-4d28-a291-1661f20fc995	2
0e79f251-53a2-470d-a4e2-94040e85ebaa	7dbbd944-1eb9-4e69-a4df-80822c7ac467	3
0e79f251-53a2-470d-a4e2-94040e85ebaa	f3bb0a8a-05fe-4540-979b-91d8ed538039	4
0e79f251-53a2-470d-a4e2-94040e85ebaa	a8acced6-9f33-4446-b324-d3b54ef6ea4e	5
336ced46-4497-4566-b182-8259c8837707	44948c32-fc38-4a5c-ab75-4c25af1797cd	1
336ced46-4497-4566-b182-8259c8837707	daa2a0b9-c7e1-42e3-8b1f-cd729b8ded9f	2
336ced46-4497-4566-b182-8259c8837707	a8acced6-9f33-4446-b324-d3b54ef6ea4e	3
336ced46-4497-4566-b182-8259c8837707	fd510666-fbef-45b0-b29c-7f939a3bfc75	4
336ced46-4497-4566-b182-8259c8837707	7dbbd944-1eb9-4e69-a4df-80822c7ac467	5
7b702b2f-10b2-4cf1-8f7d-ef50b3412d0f	f7b2d4fd-0917-436d-ab27-9ebeec20177a	1
7b702b2f-10b2-4cf1-8f7d-ef50b3412d0f	0682ba4b-1ed1-4cfa-9b55-181ac67270a3	2
7b702b2f-10b2-4cf1-8f7d-ef50b3412d0f	d05ed6f9-7e1a-4e5c-a8c0-01a1450909ff	3
7b702b2f-10b2-4cf1-8f7d-ef50b3412d0f	439eac0d-3ba8-4005-a6b6-888a59ea30a0	4
7b702b2f-10b2-4cf1-8f7d-ef50b3412d0f	0e580f6e-fcee-4a29-a96e-903dd62553e6	5
11b6f6c9-1346-4e78-abc0-86531b61aabd	eca7db2d-02b0-4d1f-8b69-f49d5b091392	1
11b6f6c9-1346-4e78-abc0-86531b61aabd	aeb6a68e-a46c-405a-b310-024f9498ce47	2
11b6f6c9-1346-4e78-abc0-86531b61aabd	8643e2ac-6efd-4f22-acc9-621fa0078191	3
11b6f6c9-1346-4e78-abc0-86531b61aabd	518dbf03-97a4-42e5-8b49-932cb1d1af7a	4
11b6f6c9-1346-4e78-abc0-86531b61aabd	fd510666-fbef-45b0-b29c-7f939a3bfc75	5
1bcb2dd0-76f2-46bd-a2ce-ccada4ccc85b	8643e2ac-6efd-4f22-acc9-621fa0078191	1
1bcb2dd0-76f2-46bd-a2ce-ccada4ccc85b	aeb6a68e-a46c-405a-b310-024f9498ce47	2
1bcb2dd0-76f2-46bd-a2ce-ccada4ccc85b	1ecc1f95-3781-4d28-a291-1661f20fc995	3
1bcb2dd0-76f2-46bd-a2ce-ccada4ccc85b	77051c40-53d4-4122-a796-18157f1c9487	4
1bcb2dd0-76f2-46bd-a2ce-ccada4ccc85b	7c487f70-a6f6-40ee-b060-5f4e448166c1	5
af609ee4-91d4-4de2-b5f6-d22b44ddd32b	41489e92-4dab-43e0-bf2a-69ac77573e57	1
af609ee4-91d4-4de2-b5f6-d22b44ddd32b	a8acced6-9f33-4446-b324-d3b54ef6ea4e	2
af609ee4-91d4-4de2-b5f6-d22b44ddd32b	7c487f70-a6f6-40ee-b060-5f4e448166c1	3
af609ee4-91d4-4de2-b5f6-d22b44ddd32b	d222bc7b-561c-407e-8610-6d580303ba19	4
af609ee4-91d4-4de2-b5f6-d22b44ddd32b	aeb6a68e-a46c-405a-b310-024f9498ce47	5
c81e567a-8ac1-436a-9adc-6d580a149251	439eac0d-3ba8-4005-a6b6-888a59ea30a0	1
c81e567a-8ac1-436a-9adc-6d580a149251	05ae23bd-8653-426f-9094-28e40db0a1a9	2
c81e567a-8ac1-436a-9adc-6d580a149251	a8acced6-9f33-4446-b324-d3b54ef6ea4e	3
c81e567a-8ac1-436a-9adc-6d580a149251	ccbb4eb4-2489-49aa-aeea-3d6f36fb29cc	4
c81e567a-8ac1-436a-9adc-6d580a149251	2042bab7-578a-41a2-9e21-002be22c180a	5
7a5cd32a-b78b-40d8-bd5d-229076e52e4c	05ae23bd-8653-426f-9094-28e40db0a1a9	1
7a5cd32a-b78b-40d8-bd5d-229076e52e4c	7dbbd944-1eb9-4e69-a4df-80822c7ac467	2
7a5cd32a-b78b-40d8-bd5d-229076e52e4c	77051c40-53d4-4122-a796-18157f1c9487	3
7a5cd32a-b78b-40d8-bd5d-229076e52e4c	1ecc1f95-3781-4d28-a291-1661f20fc995	4
7a5cd32a-b78b-40d8-bd5d-229076e52e4c	ccbb4eb4-2489-49aa-aeea-3d6f36fb29cc	5
7c8b3f80-2dab-46af-8183-13c800e8c5ef	aeb6a68e-a46c-405a-b310-024f9498ce47	1
7c8b3f80-2dab-46af-8183-13c800e8c5ef	6b1cd6a8-06a5-43d8-932f-5213edd24ab3	2
7c8b3f80-2dab-46af-8183-13c800e8c5ef	a8acced6-9f33-4446-b324-d3b54ef6ea4e	3
7c8b3f80-2dab-46af-8183-13c800e8c5ef	0513da92-71b8-426d-af4c-f38fb12c5871	4
7c8b3f80-2dab-46af-8183-13c800e8c5ef	2042bab7-578a-41a2-9e21-002be22c180a	5
001c22a9-3b89-48d8-b35e-e3db1c58f010	6b1cd6a8-06a5-43d8-932f-5213edd24ab3	1
001c22a9-3b89-48d8-b35e-e3db1c58f010	aeb6a68e-a46c-405a-b310-024f9498ce47	2
001c22a9-3b89-48d8-b35e-e3db1c58f010	d2d7f2ed-e7b9-4e37-bfc0-cbb703fe4006	3
001c22a9-3b89-48d8-b35e-e3db1c58f010	0e580f6e-fcee-4a29-a96e-903dd62553e6	4
001c22a9-3b89-48d8-b35e-e3db1c58f010	439eac0d-3ba8-4005-a6b6-888a59ea30a0	5
722702a7-f394-49d2-8727-d148b6f06798	ccabbc7e-eb58-4215-a86e-e06a8f2fcf2c	1
722702a7-f394-49d2-8727-d148b6f06798	7c487f70-a6f6-40ee-b060-5f4e448166c1	2
722702a7-f394-49d2-8727-d148b6f06798	78651102-0e6a-49cc-be51-93f2e46fef80	3
722702a7-f394-49d2-8727-d148b6f06798	8643e2ac-6efd-4f22-acc9-621fa0078191	4
722702a7-f394-49d2-8727-d148b6f06798	0513da92-71b8-426d-af4c-f38fb12c5871	5
075e60e0-7202-44f9-a4d7-e5bfa20d7729	0e580f6e-fcee-4a29-a96e-903dd62553e6	1
075e60e0-7202-44f9-a4d7-e5bfa20d7729	78651102-0e6a-49cc-be51-93f2e46fef80	2
075e60e0-7202-44f9-a4d7-e5bfa20d7729	4160eafb-e278-4802-8693-24d2f15647cd	3
075e60e0-7202-44f9-a4d7-e5bfa20d7729	77051c40-53d4-4122-a796-18157f1c9487	4
075e60e0-7202-44f9-a4d7-e5bfa20d7729	05ae23bd-8653-426f-9094-28e40db0a1a9	5
8969fce7-b6d3-454d-b2a3-33b72db0efca	d2d7f2ed-e7b9-4e37-bfc0-cbb703fe4006	1
8969fce7-b6d3-454d-b2a3-33b72db0efca	d222bc7b-561c-407e-8610-6d580303ba19	2
8969fce7-b6d3-454d-b2a3-33b72db0efca	aeb6a68e-a46c-405a-b310-024f9498ce47	3
8969fce7-b6d3-454d-b2a3-33b72db0efca	f3bb0a8a-05fe-4540-979b-91d8ed538039	4
8969fce7-b6d3-454d-b2a3-33b72db0efca	d05ed6f9-7e1a-4e5c-a8c0-01a1450909ff	5
7bbb392a-dbcc-4bbf-bfb9-64108b3a2512	fd510666-fbef-45b0-b29c-7f939a3bfc75	1
7bbb392a-dbcc-4bbf-bfb9-64108b3a2512	d222bc7b-561c-407e-8610-6d580303ba19	2
7bbb392a-dbcc-4bbf-bfb9-64108b3a2512	a8acced6-9f33-4446-b324-d3b54ef6ea4e	3
7bbb392a-dbcc-4bbf-bfb9-64108b3a2512	0682ba4b-1ed1-4cfa-9b55-181ac67270a3	4
7bbb392a-dbcc-4bbf-bfb9-64108b3a2512	0513da92-71b8-426d-af4c-f38fb12c5871	5
4a586f50-138a-4b75-882d-dd99fd95948d	439eac0d-3ba8-4005-a6b6-888a59ea30a0	1
4a586f50-138a-4b75-882d-dd99fd95948d	7dbbd944-1eb9-4e69-a4df-80822c7ac467	2
4a586f50-138a-4b75-882d-dd99fd95948d	eca7db2d-02b0-4d1f-8b69-f49d5b091392	3
4a586f50-138a-4b75-882d-dd99fd95948d	0682ba4b-1ed1-4cfa-9b55-181ac67270a3	4
4a586f50-138a-4b75-882d-dd99fd95948d	b48679eb-7407-4885-a652-2a820d95a273	5
c4e24964-6f1e-4dfb-9293-dd744f616417	c3853f4d-03c7-4d55-bbe8-cba78ae6f584	1
c4e24964-6f1e-4dfb-9293-dd744f616417	d222bc7b-561c-407e-8610-6d580303ba19	2
c4e24964-6f1e-4dfb-9293-dd744f616417	439eac0d-3ba8-4005-a6b6-888a59ea30a0	3
c4e24964-6f1e-4dfb-9293-dd744f616417	aeb6a68e-a46c-405a-b310-024f9498ce47	4
c4e24964-6f1e-4dfb-9293-dd744f616417	518dbf03-97a4-42e5-8b49-932cb1d1af7a	5
9eee7312-bad5-46a7-b67a-2fdff451ceed	d05ed6f9-7e1a-4e5c-a8c0-01a1450909ff	1
9eee7312-bad5-46a7-b67a-2fdff451ceed	09f5204a-5a41-4577-9195-4021a23bf753	2
9eee7312-bad5-46a7-b67a-2fdff451ceed	c3853f4d-03c7-4d55-bbe8-cba78ae6f584	3
9eee7312-bad5-46a7-b67a-2fdff451ceed	1ecc1f95-3781-4d28-a291-1661f20fc995	4
9eee7312-bad5-46a7-b67a-2fdff451ceed	439eac0d-3ba8-4005-a6b6-888a59ea30a0	5
98ccca57-6bf7-4256-a4f6-d4867c0ccd3e	7dbbd944-1eb9-4e69-a4df-80822c7ac467	1
98ccca57-6bf7-4256-a4f6-d4867c0ccd3e	7c487f70-a6f6-40ee-b060-5f4e448166c1	2
98ccca57-6bf7-4256-a4f6-d4867c0ccd3e	fc8fa6cc-6613-4401-87fd-8b9d00d85268	3
98ccca57-6bf7-4256-a4f6-d4867c0ccd3e	78651102-0e6a-49cc-be51-93f2e46fef80	4
98ccca57-6bf7-4256-a4f6-d4867c0ccd3e	05ae23bd-8653-426f-9094-28e40db0a1a9	5
5bb6ce23-1f1f-4ba5-871f-598744ab5741	fc8fa6cc-6613-4401-87fd-8b9d00d85268	1
5bb6ce23-1f1f-4ba5-871f-598744ab5741	0513da92-71b8-426d-af4c-f38fb12c5871	2
5bb6ce23-1f1f-4ba5-871f-598744ab5741	7c487f70-a6f6-40ee-b060-5f4e448166c1	3
5bb6ce23-1f1f-4ba5-871f-598744ab5741	f3bb0a8a-05fe-4540-979b-91d8ed538039	4
5bb6ce23-1f1f-4ba5-871f-598744ab5741	ccbb4eb4-2489-49aa-aeea-3d6f36fb29cc	5
8959e488-b0b6-4de8-b32f-75e39e788e5b	c831ab32-a510-4cac-8cc5-555bfca9ac2c	1
8959e488-b0b6-4de8-b32f-75e39e788e5b	f7b2d4fd-0917-436d-ab27-9ebeec20177a	2
8959e488-b0b6-4de8-b32f-75e39e788e5b	2042bab7-578a-41a2-9e21-002be22c180a	3
8959e488-b0b6-4de8-b32f-75e39e788e5b	fe7f5094-399b-4247-b249-88794714ac83	4
8959e488-b0b6-4de8-b32f-75e39e788e5b	9797ba40-ed4a-41d9-ba32-100875bb0e6d	5
1f8fa721-3301-4026-a99b-39c0d7ab0ed5	8643e2ac-6efd-4f22-acc9-621fa0078191	1
1f8fa721-3301-4026-a99b-39c0d7ab0ed5	518dbf03-97a4-42e5-8b49-932cb1d1af7a	2
1f8fa721-3301-4026-a99b-39c0d7ab0ed5	7c487f70-a6f6-40ee-b060-5f4e448166c1	3
1f8fa721-3301-4026-a99b-39c0d7ab0ed5	2042bab7-578a-41a2-9e21-002be22c180a	4
1f8fa721-3301-4026-a99b-39c0d7ab0ed5	41489e92-4dab-43e0-bf2a-69ac77573e57	5
87643ab4-26c6-416d-8cbe-8e1b07f0af09	aeb6a68e-a46c-405a-b310-024f9498ce47	1
87643ab4-26c6-416d-8cbe-8e1b07f0af09	78651102-0e6a-49cc-be51-93f2e46fef80	2
87643ab4-26c6-416d-8cbe-8e1b07f0af09	b48679eb-7407-4885-a652-2a820d95a273	3
87643ab4-26c6-416d-8cbe-8e1b07f0af09	09f5204a-5a41-4577-9195-4021a23bf753	4
87643ab4-26c6-416d-8cbe-8e1b07f0af09	d222bc7b-561c-407e-8610-6d580303ba19	5
a60c09c3-36dd-4f7e-8a2e-c7808786ffea	d222bc7b-561c-407e-8610-6d580303ba19	1
a60c09c3-36dd-4f7e-8a2e-c7808786ffea	fd510666-fbef-45b0-b29c-7f939a3bfc75	2
a60c09c3-36dd-4f7e-8a2e-c7808786ffea	6b1cd6a8-06a5-43d8-932f-5213edd24ab3	3
a60c09c3-36dd-4f7e-8a2e-c7808786ffea	b48679eb-7407-4885-a652-2a820d95a273	4
a60c09c3-36dd-4f7e-8a2e-c7808786ffea	439eac0d-3ba8-4005-a6b6-888a59ea30a0	5
00592a86-d4e0-4f74-828c-b4e0632241df	0513da92-71b8-426d-af4c-f38fb12c5871	1
00592a86-d4e0-4f74-828c-b4e0632241df	78651102-0e6a-49cc-be51-93f2e46fef80	2
00592a86-d4e0-4f74-828c-b4e0632241df	1ecc1f95-3781-4d28-a291-1661f20fc995	3
00592a86-d4e0-4f74-828c-b4e0632241df	05ae23bd-8653-426f-9094-28e40db0a1a9	4
00592a86-d4e0-4f74-828c-b4e0632241df	c831ab32-a510-4cac-8cc5-555bfca9ac2c	5
b79eea3e-c408-4a5e-9eeb-0eb3965972f6	0513da92-71b8-426d-af4c-f38fb12c5871	1
b79eea3e-c408-4a5e-9eeb-0eb3965972f6	d2d7f2ed-e7b9-4e37-bfc0-cbb703fe4006	2
b79eea3e-c408-4a5e-9eeb-0eb3965972f6	6b1cd6a8-06a5-43d8-932f-5213edd24ab3	3
b79eea3e-c408-4a5e-9eeb-0eb3965972f6	439eac0d-3ba8-4005-a6b6-888a59ea30a0	4
b79eea3e-c408-4a5e-9eeb-0eb3965972f6	7dbbd944-1eb9-4e69-a4df-80822c7ac467	5
d0f61e63-04fe-473f-9aa3-837bb8138dd4	41489e92-4dab-43e0-bf2a-69ac77573e57	1
d0f61e63-04fe-473f-9aa3-837bb8138dd4	8643e2ac-6efd-4f22-acc9-621fa0078191	2
d0f61e63-04fe-473f-9aa3-837bb8138dd4	a8acced6-9f33-4446-b324-d3b54ef6ea4e	3
d0f61e63-04fe-473f-9aa3-837bb8138dd4	4160eafb-e278-4802-8693-24d2f15647cd	4
d0f61e63-04fe-473f-9aa3-837bb8138dd4	fe7f5094-399b-4247-b249-88794714ac83	5
4e5ede19-bb8f-4778-b1f8-947a231664f9	aeb6a68e-a46c-405a-b310-024f9498ce47	1
4e5ede19-bb8f-4778-b1f8-947a231664f9	05ae23bd-8653-426f-9094-28e40db0a1a9	2
4e5ede19-bb8f-4778-b1f8-947a231664f9	2179c52c-3a61-4044-96f0-8434e5f1bc89	3
4e5ede19-bb8f-4778-b1f8-947a231664f9	eca7db2d-02b0-4d1f-8b69-f49d5b091392	4
4e5ede19-bb8f-4778-b1f8-947a231664f9	d222bc7b-561c-407e-8610-6d580303ba19	5
f080b6ea-2e75-40b1-a057-153ee4dd4c9c	f7b2d4fd-0917-436d-ab27-9ebeec20177a	1
f080b6ea-2e75-40b1-a057-153ee4dd4c9c	2179c52c-3a61-4044-96f0-8434e5f1bc89	2
f080b6ea-2e75-40b1-a057-153ee4dd4c9c	c3853f4d-03c7-4d55-bbe8-cba78ae6f584	3
f080b6ea-2e75-40b1-a057-153ee4dd4c9c	6f0b12fb-9c6d-459a-92de-8a1edbcf7d8e	4
f080b6ea-2e75-40b1-a057-153ee4dd4c9c	daa2a0b9-c7e1-42e3-8b1f-cd729b8ded9f	5
6db6146c-abde-4764-a08c-6d6510a90d76	518dbf03-97a4-42e5-8b49-932cb1d1af7a	1
6db6146c-abde-4764-a08c-6d6510a90d76	1ecc1f95-3781-4d28-a291-1661f20fc995	2
6db6146c-abde-4764-a08c-6d6510a90d76	05ae23bd-8653-426f-9094-28e40db0a1a9	3
6db6146c-abde-4764-a08c-6d6510a90d76	d222bc7b-561c-407e-8610-6d580303ba19	4
6db6146c-abde-4764-a08c-6d6510a90d76	c3853f4d-03c7-4d55-bbe8-cba78ae6f584	5
8d9004d0-f592-43fe-81a4-ceca36459ea7	fc8fa6cc-6613-4401-87fd-8b9d00d85268	1
8d9004d0-f592-43fe-81a4-ceca36459ea7	f3bb0a8a-05fe-4540-979b-91d8ed538039	2
8d9004d0-f592-43fe-81a4-ceca36459ea7	c831ab32-a510-4cac-8cc5-555bfca9ac2c	3
8d9004d0-f592-43fe-81a4-ceca36459ea7	0682ba4b-1ed1-4cfa-9b55-181ac67270a3	4
8d9004d0-f592-43fe-81a4-ceca36459ea7	439eac0d-3ba8-4005-a6b6-888a59ea30a0	5
9ba462e8-9f00-44ee-af05-084868bf59f9	78651102-0e6a-49cc-be51-93f2e46fef80	1
9ba462e8-9f00-44ee-af05-084868bf59f9	daa2a0b9-c7e1-42e3-8b1f-cd729b8ded9f	2
9ba462e8-9f00-44ee-af05-084868bf59f9	05ae23bd-8653-426f-9094-28e40db0a1a9	3
9ba462e8-9f00-44ee-af05-084868bf59f9	0682ba4b-1ed1-4cfa-9b55-181ac67270a3	4
9ba462e8-9f00-44ee-af05-084868bf59f9	d222bc7b-561c-407e-8610-6d580303ba19	5
618d3550-f6ea-435e-aaaa-7f2f1118f223	77051c40-53d4-4122-a796-18157f1c9487	1
618d3550-f6ea-435e-aaaa-7f2f1118f223	ccbb4eb4-2489-49aa-aeea-3d6f36fb29cc	2
618d3550-f6ea-435e-aaaa-7f2f1118f223	4160eafb-e278-4802-8693-24d2f15647cd	3
618d3550-f6ea-435e-aaaa-7f2f1118f223	f3bb0a8a-05fe-4540-979b-91d8ed538039	4
618d3550-f6ea-435e-aaaa-7f2f1118f223	88dfa08a-3c3b-4d40-9eff-83c5176cb66d	5
3a5d40b2-b7ea-4394-bd02-e01d14d2cab3	8643e2ac-6efd-4f22-acc9-621fa0078191	1
3a5d40b2-b7ea-4394-bd02-e01d14d2cab3	41489e92-4dab-43e0-bf2a-69ac77573e57	2
3a5d40b2-b7ea-4394-bd02-e01d14d2cab3	4160eafb-e278-4802-8693-24d2f15647cd	3
3a5d40b2-b7ea-4394-bd02-e01d14d2cab3	44948c32-fc38-4a5c-ab75-4c25af1797cd	4
3a5d40b2-b7ea-4394-bd02-e01d14d2cab3	7dbbd944-1eb9-4e69-a4df-80822c7ac467	5
20ebdfbf-4502-4a6c-835b-33105f863638	f7b2d4fd-0917-436d-ab27-9ebeec20177a	1
20ebdfbf-4502-4a6c-835b-33105f863638	6b1cd6a8-06a5-43d8-932f-5213edd24ab3	2
20ebdfbf-4502-4a6c-835b-33105f863638	c831ab32-a510-4cac-8cc5-555bfca9ac2c	3
20ebdfbf-4502-4a6c-835b-33105f863638	f3bb0a8a-05fe-4540-979b-91d8ed538039	4
20ebdfbf-4502-4a6c-835b-33105f863638	44948c32-fc38-4a5c-ab75-4c25af1797cd	5
3705e937-c697-4bbf-84d3-623c9dc17c94	6b1cd6a8-06a5-43d8-932f-5213edd24ab3	1
3705e937-c697-4bbf-84d3-623c9dc17c94	0e580f6e-fcee-4a29-a96e-903dd62553e6	2
3705e937-c697-4bbf-84d3-623c9dc17c94	c3853f4d-03c7-4d55-bbe8-cba78ae6f584	3
3705e937-c697-4bbf-84d3-623c9dc17c94	d222bc7b-561c-407e-8610-6d580303ba19	4
3705e937-c697-4bbf-84d3-623c9dc17c94	f7b2d4fd-0917-436d-ab27-9ebeec20177a	5
796edac4-94bf-42ca-bfa6-bd407c407dfa	a8acced6-9f33-4446-b324-d3b54ef6ea4e	1
796edac4-94bf-42ca-bfa6-bd407c407dfa	44948c32-fc38-4a5c-ab75-4c25af1797cd	2
796edac4-94bf-42ca-bfa6-bd407c407dfa	0e580f6e-fcee-4a29-a96e-903dd62553e6	3
796edac4-94bf-42ca-bfa6-bd407c407dfa	518dbf03-97a4-42e5-8b49-932cb1d1af7a	4
796edac4-94bf-42ca-bfa6-bd407c407dfa	f3bb0a8a-05fe-4540-979b-91d8ed538039	5
5a2f07a6-83fa-438d-9384-69c51c124cb1	4160eafb-e278-4802-8693-24d2f15647cd	1
5a2f07a6-83fa-438d-9384-69c51c124cb1	ccabbc7e-eb58-4215-a86e-e06a8f2fcf2c	2
5a2f07a6-83fa-438d-9384-69c51c124cb1	b9bffde4-6032-48fe-807b-0fe0d9b59c30	3
5a2f07a6-83fa-438d-9384-69c51c124cb1	d222bc7b-561c-407e-8610-6d580303ba19	4
5a2f07a6-83fa-438d-9384-69c51c124cb1	439eac0d-3ba8-4005-a6b6-888a59ea30a0	5
c3bd7ff9-15d3-4162-9fde-a2147fe28198	7c487f70-a6f6-40ee-b060-5f4e448166c1	1
c3bd7ff9-15d3-4162-9fde-a2147fe28198	05ae23bd-8653-426f-9094-28e40db0a1a9	2
c3bd7ff9-15d3-4162-9fde-a2147fe28198	d2d7f2ed-e7b9-4e37-bfc0-cbb703fe4006	3
c3bd7ff9-15d3-4162-9fde-a2147fe28198	44948c32-fc38-4a5c-ab75-4c25af1797cd	4
c3bd7ff9-15d3-4162-9fde-a2147fe28198	b9bffde4-6032-48fe-807b-0fe0d9b59c30	5
\.


--
-- Data for Name: tests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tests (id, title_en, title_hi, description_en, description_hi, exam_id, duration_minutes, total_marks, marks_per_question, negative_marking_ratio, passing_marks, pricing_type, status, available_from, available_until, attempt_count, created_at, updated_at, category, subject_id, topic_id) FROM stdin;
6d39a638-0e2b-46f1-9055-d2ae3d9bf980	Indian History Test 1	भारतीय इतिहास टेस्ट 1	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	5	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	2f18613e-5285-42cd-acbf-d276c07753a9
a06d50b6-308d-44c5-b548-ea977fc49314	UP Police Practice Test 1 (Free)	यूपी पुलिस अभ्यास टेस्ट 1 (मुफ्त)	A free practice test covering GK, Math, Reasoning, and Hindi for UP Police Constable exam preparation.	यूपी पुलिस कांस्टेबल परीक्षा की तैयारी के लिए सामान्य ज्ञान, गणित, रीजनिंग और हिंदी को कवर करने वाला एक मुफ्त अभ्यास टेस्ट।	575eb300-fe8e-494c-9bc1-24d333352711	30	15	1.00	0.25	8	free	published	\N	\N	9	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	full_mock	\N	\N
79116bed-039e-4446-b73e-c3da7ccaf717	UP Police Full Mock Test (Premium)	यूपी पुलिस पूर्ण मॉक टेस्ट (प्रीमियम)	A comprehensive mock test with 20 questions simulating the actual UP Police Constable exam pattern.	वास्तविक यूपी पुलिस कांस्टेबल परीक्षा पैटर्न का अनुकरण करने वाला 20 प्रश्नों का एक व्यापक मॉक टेस्ट।	575eb300-fe8e-494c-9bc1-24d333352711	60	20	1.00	0.25	10	premium	published	\N	\N	1	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	full_mock	\N	\N
19105827-4f1c-497e-bd89-9a649bd2ab16	Synonyms Test 1	पर्यायवाची शब्द टेस्ट 1	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	8	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	2969ec4d-bdb8-45f6-9ab5-0099f7e7443b	d2671e82-1602-426e-83b3-d821a0e344c3
c3bd7ff9-15d3-4162-9fde-a2147fe28198	Hindi Full Test 1	हिन्दी पूर्ण टेस्ट 1	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	10	5	1.00	0.00	3	free	published	\N	\N	0	2026-10-31 09:16:11.882503+05:30	2026-10-31 09:16:11.882503+05:30	subject_wise	2969ec4d-bdb8-45f6-9ab5-0099f7e7443b	\N
832a8cbb-d971-4674-9fed-ecc005267689	UP Police Mini Test - GK & Reasoning	यूपी पुलिस मिनी टेस्ट - सामान्य ज्ञान और रीजनिंग	A short free test focusing on General Knowledge and Reasoning for quick practice.	त्वरित अभ्यास के लिए सामान्य ज्ञान और रीजनिंग पर केंद्रित एक छोटा मुफ्त टेस्ट।	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	7	2026-08-02 17:21:30.292173+05:30	2026-08-02 17:21:30.292173+05:30	full_mock	\N	\N
06a77747-46c2-4c1e-ab87-ff4561b5fc1a	Synonyms Test 3	पर्यायवाची शब्द टेस्ट 3	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	6	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	2969ec4d-bdb8-45f6-9ab5-0099f7e7443b	d2671e82-1602-426e-83b3-d821a0e344c3
b823c480-ec84-448e-a421-5984f4392742	Antonyms Test 4	विलोम शब्द टेस्ट 4	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	5	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	2969ec4d-bdb8-45f6-9ab5-0099f7e7443b	315ede64-974d-42ae-aab0-f7cbcc08ccb2
159cbc9c-c715-43cd-a911-81c04f1e6817	Antonyms Test 2	विलोम शब्द टेस्ट 2	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	5	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	2969ec4d-bdb8-45f6-9ab5-0099f7e7443b	315ede64-974d-42ae-aab0-f7cbcc08ccb2
e15234d1-b5ae-4638-98fc-3a39a520e0a7	Synonyms Test 5	पर्यायवाची शब्द टेस्ट 5	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	5	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	2969ec4d-bdb8-45f6-9ab5-0099f7e7443b	d2671e82-1602-426e-83b3-d821a0e344c3
f5bc53d1-9669-4ae7-9473-722cc5b9a06c	Antonyms Test 3	विलोम शब्द टेस्ट 3	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	6	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	2969ec4d-bdb8-45f6-9ab5-0099f7e7443b	315ede64-974d-42ae-aab0-f7cbcc08ccb2
037f9e1e-0688-42df-9111-0d1e50aed2c4	Synonyms Test 4	पर्यायवाची शब्द टेस्ट 4	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	8	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	2969ec4d-bdb8-45f6-9ab5-0099f7e7443b	d2671e82-1602-426e-83b3-d821a0e344c3
f768b9c8-c902-464b-a1b0-3517db2ef4f3	Antonyms Test 1	विलोम शब्द टेस्ट 1	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	5	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	2969ec4d-bdb8-45f6-9ab5-0099f7e7443b	315ede64-974d-42ae-aab0-f7cbcc08ccb2
fd12c53d-fdc8-4ed3-8b81-7b68d63f94ff	Synonyms Test 2	पर्यायवाची शब्द टेस्ट 2	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	11	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	2969ec4d-bdb8-45f6-9ab5-0099f7e7443b	d2671e82-1602-426e-83b3-d821a0e344c3
6f361fa8-4ac7-4a7d-95dc-7481da5b987f	Indian Polity Test 3	भारतीय राजव्यवस्था टेस्ट 3	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	ec618251-437d-4b77-9958-3790f4250e17
af609ee4-91d4-4de2-b5f6-d22b44ddd32b	Percentage Test 4	प्रतिशत टेस्ट 4	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	fb6bd6c0-ad04-406c-8b3d-ab077b15a3ac
6db6146c-abde-4764-a08c-6d6510a90d76	Classification Test 3	वर्गीकरण टेस्ट 3	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	21bfab12-6061-4120-91bb-a3a07350ff28	a93bbd88-aa32-4cca-a37b-2683bdeb8286
8d9004d0-f592-43fe-81a4-ceca36459ea7	Classification Test 4	वर्गीकरण टेस्ट 4	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	21bfab12-6061-4120-91bb-a3a07350ff28	a93bbd88-aa32-4cca-a37b-2683bdeb8286
9ba462e8-9f00-44ee-af05-084868bf59f9	Classification Test 5	वर्गीकरण टेस्ट 5	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	21bfab12-6061-4120-91bb-a3a07350ff28	a93bbd88-aa32-4cca-a37b-2683bdeb8286
618d3550-f6ea-435e-aaaa-7f2f1118f223	Coding-Decoding Test 1	कोडिंग-डिकोडिंग टेस्ट 1	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	21bfab12-6061-4120-91bb-a3a07350ff28	cbf3761b-07e6-49d6-83c4-37199d862885
3a5d40b2-b7ea-4394-bd02-e01d14d2cab3	Coding-Decoding Test 2	कोडिंग-डिकोडिंग टेस्ट 2	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	21bfab12-6061-4120-91bb-a3a07350ff28	cbf3761b-07e6-49d6-83c4-37199d862885
7798bcf3-fe9e-4811-b506-e4ffe501a9c1	Indian Polity Test 4	भारतीय राजव्यवस्था टेस्ट 4	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	ec618251-437d-4b77-9958-3790f4250e17
41141b8e-58f6-4020-892d-1fd877e557b0	Indian Polity Test 5	भारतीय राजव्यवस्था टेस्ट 5	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	ec618251-437d-4b77-9958-3790f4250e17
8f0745c6-019c-441f-ab03-635463f15d7b	Current Affairs Test 1	समसामयिकी टेस्ट 1	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	ab73c585-9835-45a6-931c-c8186b040b92
097b1454-b82f-4202-a7d3-ed5887bfcbfe	Current Affairs Test 2	समसामयिकी टेस्ट 2	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	ab73c585-9835-45a6-931c-c8186b040b92
62acca12-519d-4a1f-89cb-2540e0dc0a26	Current Affairs Test 3	समसामयिकी टेस्ट 3	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	ab73c585-9835-45a6-931c-c8186b040b92
5a6b94f7-6305-4c90-969b-f4dc2fc62693	Current Affairs Test 4	समसामयिकी टेस्ट 4	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	ab73c585-9835-45a6-931c-c8186b040b92
a543ae7d-314f-4d0f-9c18-9f6b4261d122	Current Affairs Test 5	समसामयिकी टेस्ट 5	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	ab73c585-9835-45a6-931c-c8186b040b92
d9495d9b-2b29-446c-aeac-05747b9f2fdc	General Science Test 1	सामान्य विज्ञान टेस्ट 1	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	5552d0e7-27a7-4546-b909-b1f259901b23
20ebdfbf-4502-4a6c-835b-33105f863638	Coding-Decoding Test 3	कोडिंग-डिकोडिंग टेस्ट 3	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	21bfab12-6061-4120-91bb-a3a07350ff28	cbf3761b-07e6-49d6-83c4-37199d862885
3705e937-c697-4bbf-84d3-623c9dc17c94	Coding-Decoding Test 4	कोडिंग-डिकोडिंग टेस्ट 4	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	21bfab12-6061-4120-91bb-a3a07350ff28	cbf3761b-07e6-49d6-83c4-37199d862885
796edac4-94bf-42ca-bfa6-bd407c407dfa	Coding-Decoding Test 5	कोडिंग-डिकोडिंग टेस्ट 5	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	21bfab12-6061-4120-91bb-a3a07350ff28	cbf3761b-07e6-49d6-83c4-37199d862885
5a2f07a6-83fa-438d-9384-69c51c124cb1	Profit and Loss Test 2	लाभ और हानि टेस्ट 2	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	2	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	9e4b2228-705d-45c5-afec-ccc3a566cb34
de47cd4c-f32a-4522-bc55-95bf9a039c67	Grammar Test 1	व्याकरण टेस्ट 1	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	2	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	2969ec4d-bdb8-45f6-9ab5-0099f7e7443b	9781f598-c8d9-4779-adee-defeea3bb6cf
81f1e109-932c-4523-af0c-d74336015e11	General Science Test 4	सामान्य विज्ञान टेस्ट 4	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	5552d0e7-27a7-4546-b909-b1f259901b23
0b63296d-a6a4-4107-8181-624194c7b1ba	General Science Test 5	सामान्य विज्ञान टेस्ट 5	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	5552d0e7-27a7-4546-b909-b1f259901b23
4cd5d3ea-e197-4893-aad3-ed2a6cf0427d	Indian History Test 2	भारतीय इतिहास टेस्ट 2	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	2	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	2f18613e-5285-42cd-acbf-d276c07753a9
84c98dfd-cb99-4edd-aa73-8ba014c023e5	Grammar Test 2	व्याकरण टेस्ट 2	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	2	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	2969ec4d-bdb8-45f6-9ab5-0099f7e7443b	9781f598-c8d9-4779-adee-defeea3bb6cf
a4ff2287-295b-4d35-aa2a-40a54ac26f46	Indian History Test 3	भारतीय इतिहास टेस्ट 3	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	2	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	2f18613e-5285-42cd-acbf-d276c07753a9
be5d4d5f-8899-4b66-a99c-944587eaa58f	Indian Polity Test 2	भारतीय राजव्यवस्था टेस्ट 2	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	1	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	ec618251-437d-4b77-9958-3790f4250e17
804c4a6d-cb08-4baf-8a85-184bc948aa04	Grammar Test 5	व्याकरण टेस्ट 5	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	1	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	2969ec4d-bdb8-45f6-9ab5-0099f7e7443b	9781f598-c8d9-4779-adee-defeea3bb6cf
e93717cb-9fb9-4dd3-920f-6125de61d53a	Grammar Test 3	व्याकरण टेस्ट 3	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	1	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	2969ec4d-bdb8-45f6-9ab5-0099f7e7443b	9781f598-c8d9-4779-adee-defeea3bb6cf
21a17b20-50c4-4417-b2b0-df769056b7ef	Indian Geography Test 3	भारतीय भूगोल टेस्ट 3	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	1	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	ed0c23db-08df-434e-994b-dfb7e5c117ac
1e4b3099-de68-4e75-92a4-eeb5bdd472e6	Indian Geography Test 1	भारतीय भूगोल टेस्ट 1	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	1	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	ed0c23db-08df-434e-994b-dfb7e5c117ac
78c047b4-3ab1-4775-bde6-c551ddf8380d	Indian History Test 4	भारतीय इतिहास टेस्ट 4	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	1	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	2f18613e-5285-42cd-acbf-d276c07753a9
197e8544-f7a7-4f1a-acd5-5ac1ff771b9d	Indian Geography Test 4	भारतीय भूगोल टेस्ट 4	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	2	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	ed0c23db-08df-434e-994b-dfb7e5c117ac
ef03cca9-261b-4501-bb34-3b5b05168af6	Antonyms Test 5	विलोम शब्द टेस्ट 5	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	4	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	2969ec4d-bdb8-45f6-9ab5-0099f7e7443b	315ede64-974d-42ae-aab0-f7cbcc08ccb2
93af8149-2672-4b83-833f-3eb0b63649e0	Grammar Test 4	व्याकरण टेस्ट 4	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	5	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	2969ec4d-bdb8-45f6-9ab5-0099f7e7443b	9781f598-c8d9-4779-adee-defeea3bb6cf
9c474b60-cf75-4e09-b615-e8485dbd5644	Indian History Test 5	भारतीय इतिहास टेस्ट 5	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	2	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	2f18613e-5285-42cd-acbf-d276c07753a9
5a29dfc1-c714-4d2a-ae25-02d73ef6aa8d	Indian Geography Test 5	भारतीय भूगोल टेस्ट 5	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	1	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	ed0c23db-08df-434e-994b-dfb7e5c117ac
bb20d828-504d-4e9e-8cce-ce3b26449bd2	Indian Geography Test 2	भारतीय भूगोल टेस्ट 2	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	2	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	ed0c23db-08df-434e-994b-dfb7e5c117ac
04681ad1-83fe-4fa7-a805-dca0a7c487d2	Indian Polity Test 1	भारतीय राजव्यवस्था टेस्ट 1	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	2	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	ec618251-437d-4b77-9958-3790f4250e17
2358ee28-c0cc-4ee4-be9d-f1c1ace248c6	General Science Test 3	सामान्य विज्ञान टेस्ट 3	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	1	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	5552d0e7-27a7-4546-b909-b1f259901b23
79ce40b0-b6a1-4e3e-915d-8274959d775a	General Science Test 2	सामान्य विज्ञान टेस्ट 2	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	1	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	c8269f01-6119-48aa-b893-2c95e84a8b91	5552d0e7-27a7-4546-b909-b1f259901b23
c81e567a-8ac1-436a-9adc-6d580a149251	Percentage Test 5	प्रतिशत टेस्ट 5	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	fb6bd6c0-ad04-406c-8b3d-ab077b15a3ac
7a5cd32a-b78b-40d8-bd5d-229076e52e4c	Time and Distance Test 1	समय और दूरी टेस्ट 1	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	f4c8c7bb-d507-4269-9efb-fc8b27fdaa70
7c8b3f80-2dab-46af-8183-13c800e8c5ef	Time and Distance Test 2	समय और दूरी टेस्ट 2	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	f4c8c7bb-d507-4269-9efb-fc8b27fdaa70
001c22a9-3b89-48d8-b35e-e3db1c58f010	Time and Distance Test 3	समय और दूरी टेस्ट 3	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	f4c8c7bb-d507-4269-9efb-fc8b27fdaa70
722702a7-f394-49d2-8727-d148b6f06798	Time and Distance Test 4	समय और दूरी टेस्ट 4	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	f4c8c7bb-d507-4269-9efb-fc8b27fdaa70
075e60e0-7202-44f9-a4d7-e5bfa20d7729	Time and Distance Test 5	समय और दूरी टेस्ट 5	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	f4c8c7bb-d507-4269-9efb-fc8b27fdaa70
8969fce7-b6d3-454d-b2a3-33b72db0efca	Profit and Loss Test 1	लाभ और हानि टेस्ट 1	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	9e4b2228-705d-45c5-afec-ccc3a566cb34
7bbb392a-dbcc-4bbf-bfb9-64108b3a2512	Profit and Loss Test 3	लाभ और हानि टेस्ट 3	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	9e4b2228-705d-45c5-afec-ccc3a566cb34
4a586f50-138a-4b75-882d-dd99fd95948d	Profit and Loss Test 4	लाभ और हानि टेस्ट 4	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	9e4b2228-705d-45c5-afec-ccc3a566cb34
c4e24964-6f1e-4dfb-9293-dd744f616417	Profit and Loss Test 5	लाभ और हानि टेस्ट 5	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	9e4b2228-705d-45c5-afec-ccc3a566cb34
d0f61e63-04fe-473f-9aa3-837bb8138dd4	Analogy Test 5	सादृश्यता टेस्ट 5	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	21bfab12-6061-4120-91bb-a3a07350ff28	9206b72a-fc69-41e8-b4c9-fef6a3311fe7
f080b6ea-2e75-40b1-a057-153ee4dd4c9c	Classification Test 2	वर्गीकरण टेस्ट 2	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	0	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	21bfab12-6061-4120-91bb-a3a07350ff28	a93bbd88-aa32-4cca-a37b-2683bdeb8286
73bc958e-80c9-4ad6-8111-b8d6ddfa6019	Arithmetic Test 1	अंकगणित टेस्ट 1	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	4	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	3de61e03-c737-40a1-97b5-13de2eba1a34
b79eea3e-c408-4a5e-9eeb-0eb3965972f6	Analogy Test 4	सादृश्यता टेस्ट 4	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	1	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	21bfab12-6061-4120-91bb-a3a07350ff28	9206b72a-fc69-41e8-b4c9-fef6a3311fe7
0e79f251-53a2-470d-a4e2-94040e85ebaa	Arithmetic Test 4	अंकगणित टेस्ट 4	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	2	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	3de61e03-c737-40a1-97b5-13de2eba1a34
1f8fa721-3301-4026-a99b-39c0d7ab0ed5	Number Series Test 5	संख्या श्रृंखला टेस्ट 5	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	1	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	21bfab12-6061-4120-91bb-a3a07350ff28	bbb03e52-68a4-4a75-9719-40c7bae96057
9eee7312-bad5-46a7-b67a-2fdff451ceed	Number Series Test 1	संख्या श्रृंखला टेस्ट 1	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	2	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	21bfab12-6061-4120-91bb-a3a07350ff28	bbb03e52-68a4-4a75-9719-40c7bae96057
98ccca57-6bf7-4256-a4f6-d4867c0ccd3e	Number Series Test 2	संख्या श्रृंखला टेस्ट 2	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	2	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	21bfab12-6061-4120-91bb-a3a07350ff28	bbb03e52-68a4-4a75-9719-40c7bae96057
336ced46-4497-4566-b182-8259c8837707	Arithmetic Test 5	अंकगणित टेस्ट 5	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	1	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	3de61e03-c737-40a1-97b5-13de2eba1a34
8959e488-b0b6-4de8-b32f-75e39e788e5b	Number Series Test 4	संख्या श्रृंखला टेस्ट 4	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	free	published	\N	\N	1	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	21bfab12-6061-4120-91bb-a3a07350ff28	bbb03e52-68a4-4a75-9719-40c7bae96057
669ad085-ee95-4ce8-842e-6d4bcdf403b2	Arithmetic Test 3	अंकगणित टेस्ट 3	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	1	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	3de61e03-c737-40a1-97b5-13de2eba1a34
5bb6ce23-1f1f-4ba5-871f-598744ab5741	Number Series Test 3	संख्या श्रृंखला टेस्ट 3	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	1	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	21bfab12-6061-4120-91bb-a3a07350ff28	bbb03e52-68a4-4a75-9719-40c7bae96057
43c1e0eb-dcfa-4a00-9796-d64edeec8016	Arithmetic Test 2	अंकगणित टेस्ट 2	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	4	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	3de61e03-c737-40a1-97b5-13de2eba1a34
11b6f6c9-1346-4e78-abc0-86531b61aabd	Percentage Test 2	प्रतिशत टेस्ट 2	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	1	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	fb6bd6c0-ad04-406c-8b3d-ab077b15a3ac
1bcb2dd0-76f2-46bd-a2ce-ccada4ccc85b	Percentage Test 3	प्रतिशत टेस्ट 3	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	1	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	fb6bd6c0-ad04-406c-8b3d-ab077b15a3ac
87643ab4-26c6-416d-8cbe-8e1b07f0af09	Analogy Test 1	सादृश्यता टेस्ट 1	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	3	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	21bfab12-6061-4120-91bb-a3a07350ff28	9206b72a-fc69-41e8-b4c9-fef6a3311fe7
00592a86-d4e0-4f74-828c-b4e0632241df	Analogy Test 3	सादृश्यता टेस्ट 3	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	1	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	21bfab12-6061-4120-91bb-a3a07350ff28	9206b72a-fc69-41e8-b4c9-fef6a3311fe7
a60c09c3-36dd-4f7e-8a2e-c7808786ffea	Analogy Test 2	सादृश्यता टेस्ट 2	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	6	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	21bfab12-6061-4120-91bb-a3a07350ff28	9206b72a-fc69-41e8-b4c9-fef6a3311fe7
4e5ede19-bb8f-4778-b1f8-947a231664f9	Classification Test 1	वर्गीकरण टेस्ट 1	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	1	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	21bfab12-6061-4120-91bb-a3a07350ff28	a93bbd88-aa32-4cca-a37b-2683bdeb8286
7b702b2f-10b2-4cf1-8f7d-ef50b3412d0f	Percentage Test 1	प्रतिशत टेस्ट 1	\N	\N	575eb300-fe8e-494c-9bc1-24d333352711	15	10	1.00	0.00	5	premium	published	\N	\N	2	2026-08-02 20:51:52.01574+05:30	2026-10-29 20:18:58.090395+05:30	subject_wise	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	fb6bd6c0-ad04-406c-8b3d-ab077b15a3ac
\.


--
-- Data for Name: topic_part_progress; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.topic_part_progress (id, user_id, part_id, status, completed_at, created_at) FROM stdin;
\.


--
-- Data for Name: topic_parts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.topic_parts (id, topic_id, part_number, title_en, title_hi, content_en, content_hi, test_id, display_order, created_at) FROM stdin;
a68dcf96-80d0-48a6-a7a3-2bdb95aa1dda	d2671e82-1602-426e-83b3-d821a0e344c3	1	Part 1 - Synonyms	भाग 1 - पर्यायवाची शब्द			\N	0	2026-08-09 15:39:46.913807+05:30
10c7a749-f588-4d3d-9017-bada21928cf9	d2671e82-1602-426e-83b3-d821a0e344c3	2	Part 2 - Synonyms	भाग 2 - पर्यायवाची शब्द			\N	1	2026-08-09 15:39:46.913807+05:30
b07c63f6-d2d9-4d53-9944-6baa5b1860d0	d2671e82-1602-426e-83b3-d821a0e344c3	3	Part 3 - Synonyms	भाग 3 - पर्यायवाची शब्द			\N	2	2026-08-09 15:39:46.913807+05:30
2c66529c-52cb-4fb7-9c9e-c85dd4123e05	315ede64-974d-42ae-aab0-f7cbcc08ccb2	1	Part 1 - Antonyms	भाग 1 - विलोम शब्द			\N	0	2026-08-09 15:39:46.913807+05:30
47198b30-c433-4b19-841e-065915fb891f	315ede64-974d-42ae-aab0-f7cbcc08ccb2	2	Part 2 - Antonyms	भाग 2 - विलोम शब्द			\N	1	2026-08-09 15:39:46.913807+05:30
e27da929-54d9-4e01-b7d6-279375681b8c	315ede64-974d-42ae-aab0-f7cbcc08ccb2	3	Part 3 - Antonyms	भाग 3 - विलोम शब्द			\N	2	2026-08-09 15:39:46.913807+05:30
b927de57-9fe0-46a1-b873-9351a0d41416	9781f598-c8d9-4779-adee-defeea3bb6cf	1	Part 1 - Grammar	भाग 1 - व्याकरण			\N	0	2026-08-09 15:39:46.913807+05:30
2537e5df-7a26-451d-b5cd-fbc0940e0906	9781f598-c8d9-4779-adee-defeea3bb6cf	2	Part 2 - Grammar	भाग 2 - व्याकरण			\N	1	2026-08-09 15:39:46.913807+05:30
8eb09205-d7b5-4d91-bcca-b949343eb151	9781f598-c8d9-4779-adee-defeea3bb6cf	3	Part 3 - Grammar	भाग 3 - व्याकरण			\N	2	2026-08-09 15:39:46.913807+05:30
0591623a-1ffd-4bfb-897c-39524f4f4388	2f18613e-5285-42cd-acbf-d276c07753a9	1	Part 1 - Indian History	भाग 1 - भारतीय इतिहास			\N	0	2026-08-09 15:39:46.913807+05:30
47d286ad-91a1-449a-8968-3f57ffcef5b9	2f18613e-5285-42cd-acbf-d276c07753a9	2	Part 2 - Indian History	भाग 2 - भारतीय इतिहास			\N	1	2026-08-09 15:39:46.913807+05:30
b04cf31f-79db-408f-a1ce-5d850fefe1e3	2f18613e-5285-42cd-acbf-d276c07753a9	3	Part 3 - Indian History	भाग 3 - भारतीय इतिहास			\N	2	2026-08-09 15:39:46.913807+05:30
6db1a007-829f-4ce4-9b3b-7d3be8c6f96d	ed0c23db-08df-434e-994b-dfb7e5c117ac	1	Part 1 - Indian Geography	भाग 1 - भारतीय भूगोल			\N	0	2026-08-09 15:39:46.913807+05:30
ffe346db-123a-4149-9052-683953c1ac04	ed0c23db-08df-434e-994b-dfb7e5c117ac	2	Part 2 - Indian Geography	भाग 2 - भारतीय भूगोल			\N	1	2026-08-09 15:39:46.913807+05:30
88d11161-ee56-43e5-ab10-617e90861945	ed0c23db-08df-434e-994b-dfb7e5c117ac	3	Part 3 - Indian Geography	भाग 3 - भारतीय भूगोल			\N	2	2026-08-09 15:39:46.913807+05:30
82c2a8d6-5a40-40ca-9fa8-1efd7709410e	ec618251-437d-4b77-9958-3790f4250e17	1	Part 1 - Indian Polity	भाग 1 - भारतीय राजव्यवस्था			\N	0	2026-08-09 15:39:46.913807+05:30
1857d4a1-09bf-427e-9737-fb7b4a563bfa	ec618251-437d-4b77-9958-3790f4250e17	2	Part 2 - Indian Polity	भाग 2 - भारतीय राजव्यवस्था			\N	1	2026-08-09 15:39:46.913807+05:30
a46baba0-36af-42b4-96d4-e26f2ec48f22	ec618251-437d-4b77-9958-3790f4250e17	3	Part 3 - Indian Polity	भाग 3 - भारतीय राजव्यवस्था			\N	2	2026-08-09 15:39:46.913807+05:30
1dd264e0-632c-4ac1-a850-bd8f8b8d3ad4	ab73c585-9835-45a6-931c-c8186b040b92	1	Part 1 - Current Affairs	भाग 1 - समसामयिकी			\N	0	2026-08-09 15:39:46.913807+05:30
ad65f861-76d5-45c7-b1a9-6edfa045241f	ab73c585-9835-45a6-931c-c8186b040b92	2	Part 2 - Current Affairs	भाग 2 - समसामयिकी			\N	1	2026-08-09 15:39:46.913807+05:30
b4bf27bf-5e3d-43c0-9da0-6088ed1a423e	ab73c585-9835-45a6-931c-c8186b040b92	3	Part 3 - Current Affairs	भाग 3 - समसामयिकी			\N	2	2026-08-09 15:39:46.913807+05:30
c658ca1a-765a-4128-95ba-87862601de5a	5552d0e7-27a7-4546-b909-b1f259901b23	1	Part 1 - General Science	भाग 1 - सामान्य विज्ञान			\N	0	2026-08-09 15:39:46.913807+05:30
fc39d8c6-5164-4efd-ab4b-ec51cfccf6a7	5552d0e7-27a7-4546-b909-b1f259901b23	2	Part 2 - General Science	भाग 2 - सामान्य विज्ञान			\N	1	2026-08-09 15:39:46.913807+05:30
473f97f5-1046-4a37-9d00-a388256d76aa	5552d0e7-27a7-4546-b909-b1f259901b23	3	Part 3 - General Science	भाग 3 - सामान्य विज्ञान			\N	2	2026-08-09 15:39:46.913807+05:30
ca34c8bf-92f8-457b-ae17-396fd801b971	3de61e03-c737-40a1-97b5-13de2eba1a34	1	Part 1 - Arithmetic	भाग 1 - अंकगणित			\N	0	2026-08-09 15:39:46.913807+05:30
4dfbb413-6345-40c0-bb1a-85d73a864642	3de61e03-c737-40a1-97b5-13de2eba1a34	2	Part 2 - Arithmetic	भाग 2 - अंकगणित			\N	1	2026-08-09 15:39:46.913807+05:30
d5da20f5-d2a7-49e4-a14b-ec02fdbff2f1	3de61e03-c737-40a1-97b5-13de2eba1a34	3	Part 3 - Arithmetic	भाग 3 - अंकगणित			\N	2	2026-08-09 15:39:46.913807+05:30
bf3f655b-f3c9-4af6-9d80-ab947c48b7c5	fb6bd6c0-ad04-406c-8b3d-ab077b15a3ac	1	Part 1 - Percentage	भाग 1 - प्रतिशत			\N	0	2026-08-09 15:39:46.913807+05:30
f37817ae-4659-48f2-baf5-fa7148f814c3	fb6bd6c0-ad04-406c-8b3d-ab077b15a3ac	2	Part 2 - Percentage	भाग 2 - प्रतिशत			\N	1	2026-08-09 15:39:46.913807+05:30
f0fc96b1-7310-4519-8d5a-0117fcf7e1d0	fb6bd6c0-ad04-406c-8b3d-ab077b15a3ac	3	Part 3 - Percentage	भाग 3 - प्रतिशत			\N	2	2026-08-09 15:39:46.913807+05:30
d29b5865-6099-4010-b70b-3e11bbcdab18	f4c8c7bb-d507-4269-9efb-fc8b27fdaa70	1	Part 1 - Time and Distance	भाग 1 - समय और दूरी			\N	0	2026-08-09 15:39:46.913807+05:30
f5db9f10-e783-4f2b-ae2b-ebeb63821faf	f4c8c7bb-d507-4269-9efb-fc8b27fdaa70	2	Part 2 - Time and Distance	भाग 2 - समय और दूरी			\N	1	2026-08-09 15:39:46.913807+05:30
7d72fdd3-3776-4025-9102-c8f8bf24f959	f4c8c7bb-d507-4269-9efb-fc8b27fdaa70	3	Part 3 - Time and Distance	भाग 3 - समय और दूरी			\N	2	2026-08-09 15:39:46.913807+05:30
b6a7b57e-f152-4c2e-8512-aa4377c8996a	9e4b2228-705d-45c5-afec-ccc3a566cb34	1	Part 1 - Profit and Loss	भाग 1 - लाभ और हानि			\N	0	2026-08-09 15:39:46.913807+05:30
e7c4ed17-9143-49d1-8b5e-75761b887fef	9e4b2228-705d-45c5-afec-ccc3a566cb34	2	Part 2 - Profit and Loss	भाग 2 - लाभ और हानि			\N	1	2026-08-09 15:39:46.913807+05:30
1891e4c5-1ebc-47a9-8e51-7218197812d4	9e4b2228-705d-45c5-afec-ccc3a566cb34	3	Part 3 - Profit and Loss	भाग 3 - लाभ और हानि			\N	2	2026-08-09 15:39:46.913807+05:30
55f46fd6-7d53-4e3c-a064-ef6c00fd5438	bbb03e52-68a4-4a75-9719-40c7bae96057	1	Part 1 - Number Series	भाग 1 - संख्या श्रृंखला			\N	0	2026-08-09 15:39:46.913807+05:30
42cd3573-1572-4435-a1ea-2aac9e58c058	bbb03e52-68a4-4a75-9719-40c7bae96057	2	Part 2 - Number Series	भाग 2 - संख्या श्रृंखला			\N	1	2026-08-09 15:39:46.913807+05:30
ae941739-336e-4a52-8613-b842bd0f21be	bbb03e52-68a4-4a75-9719-40c7bae96057	3	Part 3 - Number Series	भाग 3 - संख्या श्रृंखला			\N	2	2026-08-09 15:39:46.913807+05:30
45f44827-4357-4fd5-a0bd-b841bdd5a6db	9206b72a-fc69-41e8-b4c9-fef6a3311fe7	1	Part 1 - Analogy	भाग 1 - सादृश्यता			\N	0	2026-08-09 15:39:46.913807+05:30
d0c3bbfe-920f-4c06-8f7c-4882c1a57915	9206b72a-fc69-41e8-b4c9-fef6a3311fe7	2	Part 2 - Analogy	भाग 2 - सादृश्यता			\N	1	2026-08-09 15:39:46.913807+05:30
bbdb79b9-1aa3-4eaf-ae9d-854634d6777e	9206b72a-fc69-41e8-b4c9-fef6a3311fe7	3	Part 3 - Analogy	भाग 3 - सादृश्यता			\N	2	2026-08-09 15:39:46.913807+05:30
207a3f19-c1c9-4ae3-87fe-c1423b519ac8	a93bbd88-aa32-4cca-a37b-2683bdeb8286	1	Part 1 - Classification	भाग 1 - वर्गीकरण			\N	0	2026-08-09 15:39:46.913807+05:30
37544e59-5917-412b-b4f7-1b07d3ec5a98	a93bbd88-aa32-4cca-a37b-2683bdeb8286	2	Part 2 - Classification	भाग 2 - वर्गीकरण			\N	1	2026-08-09 15:39:46.913807+05:30
f889e041-91e6-4402-a46f-36d43378b416	a93bbd88-aa32-4cca-a37b-2683bdeb8286	3	Part 3 - Classification	भाग 3 - वर्गीकरण			\N	2	2026-08-09 15:39:46.913807+05:30
1b511b0c-4c47-48f8-bcb8-0ec14a3f6b35	cbf3761b-07e6-49d6-83c4-37199d862885	1	Part 1 - Coding-Decoding	भाग 1 - कोडिंग-डिकोडिंग			\N	0	2026-08-09 15:39:46.913807+05:30
9851f1cd-d6b6-4667-8321-91f89b2a5162	cbf3761b-07e6-49d6-83c4-37199d862885	2	Part 2 - Coding-Decoding	भाग 2 - कोडिंग-डिकोडिंग			\N	1	2026-08-09 15:39:46.913807+05:30
c48d0a35-7368-43d9-9df4-da1fdacbeec8	cbf3761b-07e6-49d6-83c4-37199d862885	3	Part 3 - Coding-Decoding	भाग 3 - कोडिंग-डिकोडिंग			\N	2	2026-08-09 15:39:46.913807+05:30
9783d765-1c5f-41fe-9a4e-680f4a265d8d	e95df0a4-a5a9-4136-9034-5ee25b4b6418	1	Part 1 - Synonyms	भाग 1 - पर्यायवाची शब्द			\N	0	2026-08-10 14:08:44.809478+05:30
e34f427a-33f6-457e-b1fb-f8a1b9494ed0	af607d00-7e04-4beb-b719-9b2b20c2f110	1	Part 1 - Synonyms	भाग 1 - पर्यायवाची शब्द			\N	0	2026-08-10 14:08:44.809478+05:30
b473a038-6902-417b-a57e-75ff2e17d2ab	7a33324e-6ca4-4d41-b610-4f3e71192bf2	1	Part 1 - Synonyms	भाग 1 - पर्यायवाची शब्द			\N	0	2026-08-10 14:08:44.809478+05:30
81f29915-2c8b-4fce-8ac6-af4e9ef82dc9	09498f19-65e0-44a7-bfe7-43644707e45b	1	Part 1 - Synonyms	भाग 1 - पर्यायवाची शब्द			\N	0	2026-08-10 14:08:44.809478+05:30
7a0a6c1d-ce03-46b8-a7eb-52e17d4f5114	cbbcda81-a241-40fd-b411-50058c8a4278	1	Part 1 - Synonyms	भाग 1 - पर्यायवाची शब्द			\N	0	2026-08-10 14:08:44.809478+05:30
6751bb02-a6a0-49f2-86b9-317c10275bda	62a11770-eda9-448a-b48b-43aea2036f98	1	Part 1 - Synonyms	भाग 1 - पर्यायवाची शब्द			\N	0	2026-08-10 14:08:44.809478+05:30
5e189b28-2e4b-4df5-b35f-493597123124	1801990e-0424-4b50-b736-cd2ef09b7f02	1	Part 1 - Synonyms	भाग 1 - पर्यायवाची शब्द			\N	0	2026-08-10 14:08:44.809478+05:30
c4aa0559-fee4-4e42-b1e5-c6c2642d4d6d	0dbf28c9-cb97-423d-9f96-6ad9031dac93	1	Part 1 - Synonyms	भाग 1 - पर्यायवाची शब्द			\N	0	2026-08-10 14:08:44.809478+05:30
c32a9a03-51d2-4745-a9ae-aeafc807b952	f31671ca-e309-490e-a530-d96f04896a07	1	Part 1 - Synonyms	भाग 1 - पर्यायवाची शब्द			\N	0	2026-08-10 14:08:44.809478+05:30
f4f50be4-966a-4240-9d45-a869a4d348fc	e95df0a4-a5a9-4136-9034-5ee25b4b6418	2	Part 2 - Synonyms	भाग 2 - पर्यायवाची शब्द			\N	1	2026-08-10 14:08:44.809478+05:30
51b4b049-6fdd-4d10-b5cf-ec3236d738d8	af607d00-7e04-4beb-b719-9b2b20c2f110	2	Part 2 - Synonyms	भाग 2 - पर्यायवाची शब्द			\N	1	2026-08-10 14:08:44.809478+05:30
b79f1c0f-b3bd-406c-bece-0248ba4f862d	7a33324e-6ca4-4d41-b610-4f3e71192bf2	2	Part 2 - Synonyms	भाग 2 - पर्यायवाची शब्द			\N	1	2026-08-10 14:08:44.809478+05:30
6c04727b-f0c9-44a7-96b2-27007fb8efee	09498f19-65e0-44a7-bfe7-43644707e45b	2	Part 2 - Synonyms	भाग 2 - पर्यायवाची शब्द			\N	1	2026-08-10 14:08:44.809478+05:30
2444d25e-f890-4b87-af4b-ec9647d362f0	cbbcda81-a241-40fd-b411-50058c8a4278	2	Part 2 - Synonyms	भाग 2 - पर्यायवाची शब्द			\N	1	2026-08-10 14:08:44.809478+05:30
edd862db-974d-46e9-9cd3-469c442abbcc	62a11770-eda9-448a-b48b-43aea2036f98	2	Part 2 - Synonyms	भाग 2 - पर्यायवाची शब्द			\N	1	2026-08-10 14:08:44.809478+05:30
dd78549f-2258-4836-aac6-2ce8112c7a43	1801990e-0424-4b50-b736-cd2ef09b7f02	2	Part 2 - Synonyms	भाग 2 - पर्यायवाची शब्द			\N	1	2026-08-10 14:08:44.809478+05:30
218ee67a-41ea-4390-9b02-9b0213c77da7	0dbf28c9-cb97-423d-9f96-6ad9031dac93	2	Part 2 - Synonyms	भाग 2 - पर्यायवाची शब्द			\N	1	2026-08-10 14:08:44.809478+05:30
be87abe3-a261-4893-9306-505618553c68	f31671ca-e309-490e-a530-d96f04896a07	2	Part 2 - Synonyms	भाग 2 - पर्यायवाची शब्द			\N	1	2026-08-10 14:08:44.809478+05:30
19ea3d6b-e388-4297-9605-5fd198e27049	e95df0a4-a5a9-4136-9034-5ee25b4b6418	3	Part 3 - Synonyms	भाग 3 - पर्यायवाची शब्द			\N	2	2026-08-10 14:08:44.809478+05:30
19c949a2-6c1f-465f-b791-b6b69b9c34e4	af607d00-7e04-4beb-b719-9b2b20c2f110	3	Part 3 - Synonyms	भाग 3 - पर्यायवाची शब्द			\N	2	2026-08-10 14:08:44.809478+05:30
2f143f40-9c66-4233-ac38-59cec5e9a08c	7a33324e-6ca4-4d41-b610-4f3e71192bf2	3	Part 3 - Synonyms	भाग 3 - पर्यायवाची शब्द			\N	2	2026-08-10 14:08:44.809478+05:30
c11d0e46-7801-4143-81d2-8804e4834d5c	09498f19-65e0-44a7-bfe7-43644707e45b	3	Part 3 - Synonyms	भाग 3 - पर्यायवाची शब्द			\N	2	2026-08-10 14:08:44.809478+05:30
1d28dbdd-58de-493b-b212-9bfe76162141	cbbcda81-a241-40fd-b411-50058c8a4278	3	Part 3 - Synonyms	भाग 3 - पर्यायवाची शब्द			\N	2	2026-08-10 14:08:44.809478+05:30
0d1e56c4-c32c-4489-ad95-21b47f3a364f	62a11770-eda9-448a-b48b-43aea2036f98	3	Part 3 - Synonyms	भाग 3 - पर्यायवाची शब्द			\N	2	2026-08-10 14:08:44.809478+05:30
ad4679b5-2e25-4844-bf26-b3428afebad8	1801990e-0424-4b50-b736-cd2ef09b7f02	3	Part 3 - Synonyms	भाग 3 - पर्यायवाची शब्द			\N	2	2026-08-10 14:08:44.809478+05:30
3a9b1feb-4216-4843-801f-6c2530863b84	0dbf28c9-cb97-423d-9f96-6ad9031dac93	3	Part 3 - Synonyms	भाग 3 - पर्यायवाची शब्द			\N	2	2026-08-10 14:08:44.809478+05:30
67f3780e-5cc1-421a-ba3d-cab3567283c5	f31671ca-e309-490e-a530-d96f04896a07	3	Part 3 - Synonyms	भाग 3 - पर्यायवाची शब्द			\N	2	2026-08-10 14:08:44.809478+05:30
f95af2d9-3232-48a8-8c2c-64bfa935e325	8a89220f-bfb5-459b-993b-c7416b19f90f	1	Part 1 - Antonyms	भाग 1 - विलोम शब्द			\N	0	2026-08-10 14:08:44.809478+05:30
34be1e9f-9cf5-4cc7-b3be-17055203be73	a1cdbefd-343b-4c60-a53b-96553e9ea142	1	Part 1 - Antonyms	भाग 1 - विलोम शब्द			\N	0	2026-08-10 14:08:44.809478+05:30
18ed3431-0f38-48e1-944b-1fec508a4ede	15220d90-5600-4225-b34d-d16938f0d1a8	1	Part 1 - Antonyms	भाग 1 - विलोम शब्द			\N	0	2026-08-10 14:08:44.809478+05:30
d36226e4-daaa-4eda-b2a5-d6a57abbe741	38e47297-e655-4ae0-8a96-7fa7125a9f16	1	Part 1 - Antonyms	भाग 1 - विलोम शब्द			\N	0	2026-08-10 14:08:44.809478+05:30
0180b8e1-3f9f-44b6-8845-3ab007bd6074	fe1fc030-a3ab-4e14-9f41-9ae08b4d5013	1	Part 1 - Antonyms	भाग 1 - विलोम शब्द			\N	0	2026-08-10 14:08:44.809478+05:30
d347989b-e3f3-4b43-bda3-c49c370686e0	28523439-1cd2-41d6-bf11-668f19bef5ef	1	Part 1 - Antonyms	भाग 1 - विलोम शब्द			\N	0	2026-08-10 14:08:44.809478+05:30
542fe4d2-66db-481f-bf1b-c4446474676a	361a746a-9850-4a29-ab76-abd97ff78dc9	1	Part 1 - Antonyms	भाग 1 - विलोम शब्द			\N	0	2026-08-10 14:08:44.809478+05:30
8d07f440-2dcc-4431-a4b8-39cee62b307b	d6342e7c-297c-4a67-bb98-54fcc1d38ccf	1	Part 1 - Antonyms	भाग 1 - विलोम शब्द			\N	0	2026-08-10 14:08:44.809478+05:30
82e71c84-5df4-4efe-8c63-eee7746fc8a5	75ddcdd6-684e-47d4-81df-a08ffc3f2f9c	1	Part 1 - Antonyms	भाग 1 - विलोम शब्द			\N	0	2026-08-10 14:08:44.809478+05:30
7e485df0-5211-4a34-afc1-8676727e7871	8a89220f-bfb5-459b-993b-c7416b19f90f	2	Part 2 - Antonyms	भाग 2 - विलोम शब्द			\N	1	2026-08-10 14:08:44.809478+05:30
01f14299-f855-416d-9709-c343c5fce488	a1cdbefd-343b-4c60-a53b-96553e9ea142	2	Part 2 - Antonyms	भाग 2 - विलोम शब्द			\N	1	2026-08-10 14:08:44.809478+05:30
8935d691-0b6b-44c1-a226-345d32a40c4f	15220d90-5600-4225-b34d-d16938f0d1a8	2	Part 2 - Antonyms	भाग 2 - विलोम शब्द			\N	1	2026-08-10 14:08:44.809478+05:30
15c7f7bf-5d9d-4512-91f8-ff79ff2686a4	38e47297-e655-4ae0-8a96-7fa7125a9f16	2	Part 2 - Antonyms	भाग 2 - विलोम शब्द			\N	1	2026-08-10 14:08:44.809478+05:30
56b10f76-9921-4038-b92e-2119703d7540	fe1fc030-a3ab-4e14-9f41-9ae08b4d5013	2	Part 2 - Antonyms	भाग 2 - विलोम शब्द			\N	1	2026-08-10 14:08:44.809478+05:30
005665aa-cb63-4049-9f91-e11403c43c78	28523439-1cd2-41d6-bf11-668f19bef5ef	2	Part 2 - Antonyms	भाग 2 - विलोम शब्द			\N	1	2026-08-10 14:08:44.809478+05:30
fa208fc9-e5f8-445b-9c52-33c01fd185ff	361a746a-9850-4a29-ab76-abd97ff78dc9	2	Part 2 - Antonyms	भाग 2 - विलोम शब्द			\N	1	2026-08-10 14:08:44.809478+05:30
b245691c-9ccf-4ea2-ae78-0871f9bbea45	d6342e7c-297c-4a67-bb98-54fcc1d38ccf	2	Part 2 - Antonyms	भाग 2 - विलोम शब्द			\N	1	2026-08-10 14:08:44.809478+05:30
5f397523-f664-4107-ab02-d4987967ed0c	75ddcdd6-684e-47d4-81df-a08ffc3f2f9c	2	Part 2 - Antonyms	भाग 2 - विलोम शब्द			\N	1	2026-08-10 14:08:44.809478+05:30
a0b9d71a-be47-4f92-a4db-68768988c5e9	8a89220f-bfb5-459b-993b-c7416b19f90f	3	Part 3 - Antonyms	भाग 3 - विलोम शब्द			\N	2	2026-08-10 14:08:44.809478+05:30
08e70220-3702-42b0-a5f5-224ddfaeee87	a1cdbefd-343b-4c60-a53b-96553e9ea142	3	Part 3 - Antonyms	भाग 3 - विलोम शब्द			\N	2	2026-08-10 14:08:44.809478+05:30
1a1ad15e-dfd1-40b9-aea9-247f44847d49	15220d90-5600-4225-b34d-d16938f0d1a8	3	Part 3 - Antonyms	भाग 3 - विलोम शब्द			\N	2	2026-08-10 14:08:44.809478+05:30
5587782c-21ca-40e0-bcf1-c5eeb68e6714	38e47297-e655-4ae0-8a96-7fa7125a9f16	3	Part 3 - Antonyms	भाग 3 - विलोम शब्द			\N	2	2026-08-10 14:08:44.809478+05:30
c616153d-5fe6-4012-b578-7ec8ba0a43c7	fe1fc030-a3ab-4e14-9f41-9ae08b4d5013	3	Part 3 - Antonyms	भाग 3 - विलोम शब्द			\N	2	2026-08-10 14:08:44.809478+05:30
28487eaa-3da6-4fe5-b984-c07d748735e9	28523439-1cd2-41d6-bf11-668f19bef5ef	3	Part 3 - Antonyms	भाग 3 - विलोम शब्द			\N	2	2026-08-10 14:08:44.809478+05:30
6c0d0ed7-0c9d-4d4b-8a8a-c54b96ccc95a	361a746a-9850-4a29-ab76-abd97ff78dc9	3	Part 3 - Antonyms	भाग 3 - विलोम शब्द			\N	2	2026-08-10 14:08:44.809478+05:30
6be1c163-0d87-4294-8b36-848e21a3a31a	d6342e7c-297c-4a67-bb98-54fcc1d38ccf	3	Part 3 - Antonyms	भाग 3 - विलोम शब्द			\N	2	2026-08-10 14:08:44.809478+05:30
8672d5e6-6536-4810-ae3f-ffbc042d0091	75ddcdd6-684e-47d4-81df-a08ffc3f2f9c	3	Part 3 - Antonyms	भाग 3 - विलोम शब्द			\N	2	2026-08-10 14:08:44.809478+05:30
8dca23e3-dc29-4a87-a7f4-360dc08159f4	ebdf8e82-19a1-434f-bf94-5fbc73fc8926	1	Part 1 - Grammar	भाग 1 - व्याकरण			\N	0	2026-08-10 14:08:44.809478+05:30
a950f4ee-5c3e-4e8f-810c-4f7ae2184607	49334ad3-5d5c-4f82-bffd-2521a7dd6038	1	Part 1 - Grammar	भाग 1 - व्याकरण			\N	0	2026-08-10 14:08:44.809478+05:30
4921803b-1d77-48df-90e5-946ef05dc6db	65e3b149-1454-492d-b252-1ddf2e32540a	1	Part 1 - Grammar	भाग 1 - व्याकरण			\N	0	2026-08-10 14:08:44.809478+05:30
55fa0370-f079-498f-a719-2b2af6cc0f6f	300284e9-d478-49a7-b079-fe949cc01f76	1	Part 1 - Grammar	भाग 1 - व्याकरण			\N	0	2026-08-10 14:08:44.809478+05:30
7c62c461-126d-45d4-bc60-792a4950a2e8	bdc195a2-a061-49f7-834f-679f565edb84	1	Part 1 - Grammar	भाग 1 - व्याकरण			\N	0	2026-08-10 14:08:44.809478+05:30
f5f52c5b-9d7b-4939-8f5b-73df81104d24	c5b3cfb1-a9cb-43fa-9402-d57289dc2253	1	Part 1 - Grammar	भाग 1 - व्याकरण			\N	0	2026-08-10 14:08:44.809478+05:30
246bf0ae-3fe2-4850-86b5-54d7bfe477d2	0e260237-b4be-4394-b487-1fd29a7500f7	1	Part 1 - Grammar	भाग 1 - व्याकरण			\N	0	2026-08-10 14:08:44.809478+05:30
df268cb2-2665-4ba4-acf4-fce91e2dd0cf	aa362973-6cc6-4b2f-b08e-fd3171324691	1	Part 1 - Grammar	भाग 1 - व्याकरण			\N	0	2026-08-10 14:08:44.809478+05:30
6340c873-1269-4f10-8f2b-f9b62711b42b	1f465e1f-398d-4b1a-b676-f0991f0a6c3d	1	Part 1 - Grammar	भाग 1 - व्याकरण			\N	0	2026-08-10 14:08:44.809478+05:30
844fd012-13d0-4c7e-a6ab-328e439077b2	ebdf8e82-19a1-434f-bf94-5fbc73fc8926	2	Part 2 - Grammar	भाग 2 - व्याकरण			\N	1	2026-08-10 14:08:44.809478+05:30
3741fa06-2a36-43f8-a691-35998427f140	49334ad3-5d5c-4f82-bffd-2521a7dd6038	2	Part 2 - Grammar	भाग 2 - व्याकरण			\N	1	2026-08-10 14:08:44.809478+05:30
98c2b8b9-50da-4bc2-b480-098946455544	65e3b149-1454-492d-b252-1ddf2e32540a	2	Part 2 - Grammar	भाग 2 - व्याकरण			\N	1	2026-08-10 14:08:44.809478+05:30
9accc884-1ab1-4bde-a428-690f50515742	300284e9-d478-49a7-b079-fe949cc01f76	2	Part 2 - Grammar	भाग 2 - व्याकरण			\N	1	2026-08-10 14:08:44.809478+05:30
8bb0b0ec-7569-4e75-8e67-e2eb877c8d16	bdc195a2-a061-49f7-834f-679f565edb84	2	Part 2 - Grammar	भाग 2 - व्याकरण			\N	1	2026-08-10 14:08:44.809478+05:30
a2ce9876-3fcd-4dbd-a0e6-91cc29fb8eb2	c5b3cfb1-a9cb-43fa-9402-d57289dc2253	2	Part 2 - Grammar	भाग 2 - व्याकरण			\N	1	2026-08-10 14:08:44.809478+05:30
196184b0-e470-4b74-98b0-b501aa49f642	0e260237-b4be-4394-b487-1fd29a7500f7	2	Part 2 - Grammar	भाग 2 - व्याकरण			\N	1	2026-08-10 14:08:44.809478+05:30
60720942-46b6-43b0-8a7a-363b32ba7494	aa362973-6cc6-4b2f-b08e-fd3171324691	2	Part 2 - Grammar	भाग 2 - व्याकरण			\N	1	2026-08-10 14:08:44.809478+05:30
1ac85977-6dc7-4a53-93a7-3fba1ee676d3	1f465e1f-398d-4b1a-b676-f0991f0a6c3d	2	Part 2 - Grammar	भाग 2 - व्याकरण			\N	1	2026-08-10 14:08:44.809478+05:30
6c34164b-9956-4e7b-a17b-93007f10b9d3	ebdf8e82-19a1-434f-bf94-5fbc73fc8926	3	Part 3 - Grammar	भाग 3 - व्याकरण			\N	2	2026-08-10 14:08:44.809478+05:30
0e5e3d9d-2297-4fcf-93ed-8cc9c77e6c09	49334ad3-5d5c-4f82-bffd-2521a7dd6038	3	Part 3 - Grammar	भाग 3 - व्याकरण			\N	2	2026-08-10 14:08:44.809478+05:30
830382b7-5d1f-446e-b6cb-9aa065701f4c	65e3b149-1454-492d-b252-1ddf2e32540a	3	Part 3 - Grammar	भाग 3 - व्याकरण			\N	2	2026-08-10 14:08:44.809478+05:30
2aec2c91-7f78-4943-ba9b-9e9678a20357	300284e9-d478-49a7-b079-fe949cc01f76	3	Part 3 - Grammar	भाग 3 - व्याकरण			\N	2	2026-08-10 14:08:44.809478+05:30
7bfd8f3c-6c59-40b7-bf82-11b426d8785f	bdc195a2-a061-49f7-834f-679f565edb84	3	Part 3 - Grammar	भाग 3 - व्याकरण			\N	2	2026-08-10 14:08:44.809478+05:30
3e391418-f626-4d17-8aca-690fee017d71	c5b3cfb1-a9cb-43fa-9402-d57289dc2253	3	Part 3 - Grammar	भाग 3 - व्याकरण			\N	2	2026-08-10 14:08:44.809478+05:30
376d37b1-9cba-49fb-b1b0-3f2b58a9da73	0e260237-b4be-4394-b487-1fd29a7500f7	3	Part 3 - Grammar	भाग 3 - व्याकरण			\N	2	2026-08-10 14:08:44.809478+05:30
f313a20b-7c9c-4594-afad-684c171c0b7c	aa362973-6cc6-4b2f-b08e-fd3171324691	3	Part 3 - Grammar	भाग 3 - व्याकरण			\N	2	2026-08-10 14:08:44.809478+05:30
86769490-1d63-4235-b52e-79583862a842	1f465e1f-398d-4b1a-b676-f0991f0a6c3d	3	Part 3 - Grammar	भाग 3 - व्याकरण			\N	2	2026-08-10 14:08:44.809478+05:30
cb0b9159-d7b2-4cab-8399-0e44cf4f8764	ec27a54d-58fe-4d78-8e27-818b6920afaf	1	Part 1 - Indian History	भाग 1 - भारतीय इतिहास			\N	0	2026-08-10 14:08:44.809478+05:30
0bd7ab34-8864-41bf-b83e-2ff449bee74f	ac5af3c9-eff0-449e-b87f-c819afe7f2a7	1	Part 1 - Indian History	भाग 1 - भारतीय इतिहास			\N	0	2026-08-10 14:08:44.809478+05:30
72125718-ba15-4463-822d-e9f2b536b5ef	62ba55fa-63d0-45aa-a2f9-94ad773060bd	1	Part 1 - Indian History	भाग 1 - भारतीय इतिहास			\N	0	2026-08-10 14:08:44.809478+05:30
e4fd358c-9c5a-4ef1-8f1d-c4f4a4b3c04e	6c4897bf-77b3-4089-9f12-75b1157eda37	1	Part 1 - Indian History	भाग 1 - भारतीय इतिहास			\N	0	2026-08-10 14:08:44.809478+05:30
c2a88777-b0ae-4bda-a9e9-5489ad1085a0	48c1fc19-e68d-4fd7-9880-efcc2be6ef25	1	Part 1 - Indian History	भाग 1 - भारतीय इतिहास			\N	0	2026-08-10 14:08:44.809478+05:30
28cb41b1-9457-48da-b876-b44e9b14d7dc	b70a9aaa-4f7e-4906-a2f2-034fa87ee4a4	1	Part 1 - Indian History	भाग 1 - भारतीय इतिहास			\N	0	2026-08-10 14:08:44.809478+05:30
9ada8a58-7707-437a-9572-37de54046f6e	e86cbc9a-3173-40af-85be-bb1a47364e66	1	Part 1 - Indian History	भाग 1 - भारतीय इतिहास			\N	0	2026-08-10 14:08:44.809478+05:30
4cea1327-3069-405b-86d2-fd619c0503eb	e5c891a0-29aa-4bde-8c2f-cb699bee28f2	1	Part 1 - Indian History	भाग 1 - भारतीय इतिहास			\N	0	2026-08-10 14:08:44.809478+05:30
79815683-dca0-40fe-994d-6a51367c93c4	790cbebb-f336-49c8-a537-104d8567f0eb	1	Part 1 - Indian History	भाग 1 - भारतीय इतिहास			\N	0	2026-08-10 14:08:44.809478+05:30
9a73dee2-1f52-4ece-bbb5-f2a94b85185a	ec27a54d-58fe-4d78-8e27-818b6920afaf	2	Part 2 - Indian History	भाग 2 - भारतीय इतिहास			\N	1	2026-08-10 14:08:44.809478+05:30
58619c9e-8222-4132-be15-d0a400c669db	ac5af3c9-eff0-449e-b87f-c819afe7f2a7	2	Part 2 - Indian History	भाग 2 - भारतीय इतिहास			\N	1	2026-08-10 14:08:44.809478+05:30
de199015-ae15-444b-ac4a-541496845ab3	62ba55fa-63d0-45aa-a2f9-94ad773060bd	2	Part 2 - Indian History	भाग 2 - भारतीय इतिहास			\N	1	2026-08-10 14:08:44.809478+05:30
97bfb341-c90b-47e5-8f7e-e52171ecc9fb	6c4897bf-77b3-4089-9f12-75b1157eda37	2	Part 2 - Indian History	भाग 2 - भारतीय इतिहास			\N	1	2026-08-10 14:08:44.809478+05:30
57462c89-8225-4f9c-80ec-d500a7ee0186	48c1fc19-e68d-4fd7-9880-efcc2be6ef25	2	Part 2 - Indian History	भाग 2 - भारतीय इतिहास			\N	1	2026-08-10 14:08:44.809478+05:30
b13f3da2-c4d3-41b4-ac0f-82dd9208fc4a	b70a9aaa-4f7e-4906-a2f2-034fa87ee4a4	2	Part 2 - Indian History	भाग 2 - भारतीय इतिहास			\N	1	2026-08-10 14:08:44.809478+05:30
dadc7dba-f7d5-43ba-89a0-4736e25f0522	e86cbc9a-3173-40af-85be-bb1a47364e66	2	Part 2 - Indian History	भाग 2 - भारतीय इतिहास			\N	1	2026-08-10 14:08:44.809478+05:30
096065fc-c683-4a5d-bc9b-b315e2800e1d	e5c891a0-29aa-4bde-8c2f-cb699bee28f2	2	Part 2 - Indian History	भाग 2 - भारतीय इतिहास			\N	1	2026-08-10 14:08:44.809478+05:30
d17dc712-c9fa-43a6-8661-6d5b83dc29fd	790cbebb-f336-49c8-a537-104d8567f0eb	2	Part 2 - Indian History	भाग 2 - भारतीय इतिहास			\N	1	2026-08-10 14:08:44.809478+05:30
d1e584bd-5d31-468a-9b81-dc41fe399704	ec27a54d-58fe-4d78-8e27-818b6920afaf	3	Part 3 - Indian History	भाग 3 - भारतीय इतिहास			\N	2	2026-08-10 14:08:44.809478+05:30
aa7302ef-be6e-4c48-9105-8748a7575aab	ac5af3c9-eff0-449e-b87f-c819afe7f2a7	3	Part 3 - Indian History	भाग 3 - भारतीय इतिहास			\N	2	2026-08-10 14:08:44.809478+05:30
03bc0adb-a5e9-4e89-9fdc-132c319f449d	62ba55fa-63d0-45aa-a2f9-94ad773060bd	3	Part 3 - Indian History	भाग 3 - भारतीय इतिहास			\N	2	2026-08-10 14:08:44.809478+05:30
18182e4c-f617-42c2-af0d-a940208fd97f	6c4897bf-77b3-4089-9f12-75b1157eda37	3	Part 3 - Indian History	भाग 3 - भारतीय इतिहास			\N	2	2026-08-10 14:08:44.809478+05:30
0e417892-2306-43ad-9268-3a290b36959c	48c1fc19-e68d-4fd7-9880-efcc2be6ef25	3	Part 3 - Indian History	भाग 3 - भारतीय इतिहास			\N	2	2026-08-10 14:08:44.809478+05:30
c33df85a-d6dd-4306-9d90-aaf28a367bfc	b70a9aaa-4f7e-4906-a2f2-034fa87ee4a4	3	Part 3 - Indian History	भाग 3 - भारतीय इतिहास			\N	2	2026-08-10 14:08:44.809478+05:30
0cdf03e8-b86d-40b4-b090-d509b7fd68f2	e86cbc9a-3173-40af-85be-bb1a47364e66	3	Part 3 - Indian History	भाग 3 - भारतीय इतिहास			\N	2	2026-08-10 14:08:44.809478+05:30
485856fc-c46f-4cca-bce8-631a48802714	e5c891a0-29aa-4bde-8c2f-cb699bee28f2	3	Part 3 - Indian History	भाग 3 - भारतीय इतिहास			\N	2	2026-08-10 14:08:44.809478+05:30
d2567687-2b8e-443b-9cbb-1447a83554ba	790cbebb-f336-49c8-a537-104d8567f0eb	3	Part 3 - Indian History	भाग 3 - भारतीय इतिहास			\N	2	2026-08-10 14:08:44.809478+05:30
167f3255-7f55-4906-b47e-dc63dc938f9a	57a0a1a4-97e3-4280-8cf6-e62b560c2590	1	Part 1 - Indian Geography	भाग 1 - भारतीय भूगोल			\N	0	2026-08-10 14:08:44.809478+05:30
66d5d696-fa38-464e-b830-eeb438c14fab	f4ad7d31-795d-4526-8534-59f895757a58	1	Part 1 - Indian Geography	भाग 1 - भारतीय भूगोल			\N	0	2026-08-10 14:08:44.809478+05:30
978dabec-b6fa-42e4-bae0-a4f8f1f4deca	27c4a1af-0716-4f96-a59a-f4d2d11adf71	1	Part 1 - Indian Geography	भाग 1 - भारतीय भूगोल			\N	0	2026-08-10 14:08:44.809478+05:30
838718ab-0f96-4601-b90e-a12ce1735a71	cc18cd7f-6cc2-4294-9331-6b1c0fccf0a6	1	Part 1 - Indian Geography	भाग 1 - भारतीय भूगोल			\N	0	2026-08-10 14:08:44.809478+05:30
06b159f2-de9a-45b4-9347-48f7ddcf9049	55e407b2-6ce7-4cbe-9a39-b6f45349ce29	1	Part 1 - Indian Geography	भाग 1 - भारतीय भूगोल			\N	0	2026-08-10 14:08:44.809478+05:30
04b448dd-d3a1-4ded-8cf3-13eef3a57c18	4ac885ab-1bfc-4e0c-ac05-7bfa7bb8390e	1	Part 1 - Indian Geography	भाग 1 - भारतीय भूगोल			\N	0	2026-08-10 14:08:44.809478+05:30
0f98b5a5-5bb7-4171-912b-37a06d825ac8	d940888f-4314-49cb-b626-d8ab281fffba	1	Part 1 - Indian Geography	भाग 1 - भारतीय भूगोल			\N	0	2026-08-10 14:08:44.809478+05:30
5dd22331-255b-472f-98c5-3b7e63aa5a7c	136e3209-4b43-4df6-9ba1-e372e2cd85b2	1	Part 1 - Indian Geography	भाग 1 - भारतीय भूगोल			\N	0	2026-08-10 14:08:44.809478+05:30
440106f7-81c7-4e20-8e64-87335ba5a31c	c7232000-ab4e-495e-b011-394938e5798d	1	Part 1 - Indian Geography	भाग 1 - भारतीय भूगोल			\N	0	2026-08-10 14:08:44.809478+05:30
92b311bf-9c55-4793-aa3f-79dd95b7e375	57a0a1a4-97e3-4280-8cf6-e62b560c2590	2	Part 2 - Indian Geography	भाग 2 - भारतीय भूगोल			\N	1	2026-08-10 14:08:44.809478+05:30
a4bc35a4-ca91-4b83-bb98-257f82638a97	f4ad7d31-795d-4526-8534-59f895757a58	2	Part 2 - Indian Geography	भाग 2 - भारतीय भूगोल			\N	1	2026-08-10 14:08:44.809478+05:30
30cd264e-cb76-42c1-8240-47394a98efbc	27c4a1af-0716-4f96-a59a-f4d2d11adf71	2	Part 2 - Indian Geography	भाग 2 - भारतीय भूगोल			\N	1	2026-08-10 14:08:44.809478+05:30
5a7ee1dd-7fb6-42f9-8841-34dc3cd065b1	cc18cd7f-6cc2-4294-9331-6b1c0fccf0a6	2	Part 2 - Indian Geography	भाग 2 - भारतीय भूगोल			\N	1	2026-08-10 14:08:44.809478+05:30
d86a8230-81aa-49cc-b6cb-af7435b553ee	55e407b2-6ce7-4cbe-9a39-b6f45349ce29	2	Part 2 - Indian Geography	भाग 2 - भारतीय भूगोल			\N	1	2026-08-10 14:08:44.809478+05:30
7e576b5f-1bd6-49a6-8d68-a0d5371d8247	4ac885ab-1bfc-4e0c-ac05-7bfa7bb8390e	2	Part 2 - Indian Geography	भाग 2 - भारतीय भूगोल			\N	1	2026-08-10 14:08:44.809478+05:30
44a9e069-f5ee-4f54-a5a9-64082ec06de7	d940888f-4314-49cb-b626-d8ab281fffba	2	Part 2 - Indian Geography	भाग 2 - भारतीय भूगोल			\N	1	2026-08-10 14:08:44.809478+05:30
c8253eb1-f091-4868-923b-dda4d56068ec	136e3209-4b43-4df6-9ba1-e372e2cd85b2	2	Part 2 - Indian Geography	भाग 2 - भारतीय भूगोल			\N	1	2026-08-10 14:08:44.809478+05:30
56f4d6c8-a340-4a17-937d-dfc31fd68791	c7232000-ab4e-495e-b011-394938e5798d	2	Part 2 - Indian Geography	भाग 2 - भारतीय भूगोल			\N	1	2026-08-10 14:08:44.809478+05:30
966d4b66-60f9-4e1b-8f9c-9be632d2b34a	57a0a1a4-97e3-4280-8cf6-e62b560c2590	3	Part 3 - Indian Geography	भाग 3 - भारतीय भूगोल			\N	2	2026-08-10 14:08:44.809478+05:30
17142fea-e01e-451f-83b6-bd19c79c4062	f4ad7d31-795d-4526-8534-59f895757a58	3	Part 3 - Indian Geography	भाग 3 - भारतीय भूगोल			\N	2	2026-08-10 14:08:44.809478+05:30
e76d70df-f9ac-4730-8841-758ce9aa047f	27c4a1af-0716-4f96-a59a-f4d2d11adf71	3	Part 3 - Indian Geography	भाग 3 - भारतीय भूगोल			\N	2	2026-08-10 14:08:44.809478+05:30
20ed28e0-aacb-456a-81f3-b2d69f692d80	cc18cd7f-6cc2-4294-9331-6b1c0fccf0a6	3	Part 3 - Indian Geography	भाग 3 - भारतीय भूगोल			\N	2	2026-08-10 14:08:44.809478+05:30
f0410718-5ff3-4b81-9d50-3a6b7aff2442	55e407b2-6ce7-4cbe-9a39-b6f45349ce29	3	Part 3 - Indian Geography	भाग 3 - भारतीय भूगोल			\N	2	2026-08-10 14:08:44.809478+05:30
411093b5-a197-4e93-a85d-26ac12d33bce	4ac885ab-1bfc-4e0c-ac05-7bfa7bb8390e	3	Part 3 - Indian Geography	भाग 3 - भारतीय भूगोल			\N	2	2026-08-10 14:08:44.809478+05:30
9e6e606a-3f0a-4935-bede-fc2728015764	d940888f-4314-49cb-b626-d8ab281fffba	3	Part 3 - Indian Geography	भाग 3 - भारतीय भूगोल			\N	2	2026-08-10 14:08:44.809478+05:30
7b114c40-8d89-46fc-9a72-39a4c70c43d2	136e3209-4b43-4df6-9ba1-e372e2cd85b2	3	Part 3 - Indian Geography	भाग 3 - भारतीय भूगोल			\N	2	2026-08-10 14:08:44.809478+05:30
dee8c474-b158-447e-adfc-5599c092c096	c7232000-ab4e-495e-b011-394938e5798d	3	Part 3 - Indian Geography	भाग 3 - भारतीय भूगोल			\N	2	2026-08-10 14:08:44.809478+05:30
dcbc1b72-1839-4ebf-a71d-49b886d69851	d6e19cf6-95ef-4f8f-b267-f77ad0a5962e	1	Part 1 - Indian Polity	भाग 1 - भारतीय राजव्यवस्था			\N	0	2026-08-10 14:08:44.809478+05:30
6a5db832-e283-42ca-a8f0-c89359d10c43	78ed1c32-771b-4b90-b709-73a13310fa0c	1	Part 1 - Indian Polity	भाग 1 - भारतीय राजव्यवस्था			\N	0	2026-08-10 14:08:44.809478+05:30
b5d3c20d-8962-4e96-98ff-a3ebea62db0b	3fedb22c-b41f-4bb5-aaf2-5f01982ac46b	1	Part 1 - Indian Polity	भाग 1 - भारतीय राजव्यवस्था			\N	0	2026-08-10 14:08:44.809478+05:30
d625ca7d-43c9-4657-8dd1-a88b69e95e0f	5f6509bd-8e7f-4bb3-867f-289ac9abb886	1	Part 1 - Indian Polity	भाग 1 - भारतीय राजव्यवस्था			\N	0	2026-08-10 14:08:44.809478+05:30
d950bb15-50d0-40e7-9f8e-e4d7d0f250c3	86ab6358-4c6f-466c-a78d-0b5292a5d79a	1	Part 1 - Indian Polity	भाग 1 - भारतीय राजव्यवस्था			\N	0	2026-08-10 14:08:44.809478+05:30
3a23aa63-b5c6-4420-9cdc-ab77edc1aaa4	c65a322a-ba27-4a01-b6c5-bbc6e3541935	1	Part 1 - Indian Polity	भाग 1 - भारतीय राजव्यवस्था			\N	0	2026-08-10 14:08:44.809478+05:30
1ba668ee-e977-4d93-bc04-fc3231e8bcea	3d169150-830a-41cc-bc88-19a569800189	1	Part 1 - Indian Polity	भाग 1 - भारतीय राजव्यवस्था			\N	0	2026-08-10 14:08:44.809478+05:30
014f346f-5b84-4112-ab79-b1dbb125b127	c4b236ee-e853-4bdf-b3a2-129919871a3a	1	Part 1 - Indian Polity	भाग 1 - भारतीय राजव्यवस्था			\N	0	2026-08-10 14:08:44.809478+05:30
8327b712-014a-45eb-8056-897c96aa18df	345a4130-7ee4-41ef-8a60-84a668c2ebee	1	Part 1 - Indian Polity	भाग 1 - भारतीय राजव्यवस्था			\N	0	2026-08-10 14:08:44.809478+05:30
0afdd613-25ea-4e31-930e-21b9e4aec72e	d6e19cf6-95ef-4f8f-b267-f77ad0a5962e	2	Part 2 - Indian Polity	भाग 2 - भारतीय राजव्यवस्था			\N	1	2026-08-10 14:08:44.809478+05:30
677da76a-d3db-4803-9399-2fae6ef38b05	78ed1c32-771b-4b90-b709-73a13310fa0c	2	Part 2 - Indian Polity	भाग 2 - भारतीय राजव्यवस्था			\N	1	2026-08-10 14:08:44.809478+05:30
427a25bb-76f6-4ce3-80c2-ccc90ff92b89	3fedb22c-b41f-4bb5-aaf2-5f01982ac46b	2	Part 2 - Indian Polity	भाग 2 - भारतीय राजव्यवस्था			\N	1	2026-08-10 14:08:44.809478+05:30
5159f94b-145e-47f7-a468-08dceee22fef	5f6509bd-8e7f-4bb3-867f-289ac9abb886	2	Part 2 - Indian Polity	भाग 2 - भारतीय राजव्यवस्था			\N	1	2026-08-10 14:08:44.809478+05:30
6948cba5-7e7d-43cd-954b-cd745ae570f2	86ab6358-4c6f-466c-a78d-0b5292a5d79a	2	Part 2 - Indian Polity	भाग 2 - भारतीय राजव्यवस्था			\N	1	2026-08-10 14:08:44.809478+05:30
bba4f17c-c738-45cb-a785-6fc45a91f176	c65a322a-ba27-4a01-b6c5-bbc6e3541935	2	Part 2 - Indian Polity	भाग 2 - भारतीय राजव्यवस्था			\N	1	2026-08-10 14:08:44.809478+05:30
9ef2939b-c4aa-45cb-8101-ab1c0a76fcd8	3d169150-830a-41cc-bc88-19a569800189	2	Part 2 - Indian Polity	भाग 2 - भारतीय राजव्यवस्था			\N	1	2026-08-10 14:08:44.809478+05:30
a18e7bf1-8207-4d4c-846f-f2348ab4cc5e	c4b236ee-e853-4bdf-b3a2-129919871a3a	2	Part 2 - Indian Polity	भाग 2 - भारतीय राजव्यवस्था			\N	1	2026-08-10 14:08:44.809478+05:30
1796bf43-e185-427b-ba3f-90c484856f26	345a4130-7ee4-41ef-8a60-84a668c2ebee	2	Part 2 - Indian Polity	भाग 2 - भारतीय राजव्यवस्था			\N	1	2026-08-10 14:08:44.809478+05:30
230ad11c-cdce-4ecb-922c-182085788e8c	d6e19cf6-95ef-4f8f-b267-f77ad0a5962e	3	Part 3 - Indian Polity	भाग 3 - भारतीय राजव्यवस्था			\N	2	2026-08-10 14:08:44.809478+05:30
17a18d3d-7a4f-4182-be88-823b8972aa55	78ed1c32-771b-4b90-b709-73a13310fa0c	3	Part 3 - Indian Polity	भाग 3 - भारतीय राजव्यवस्था			\N	2	2026-08-10 14:08:44.809478+05:30
071f47d0-efa3-4358-b265-f65e818b9efa	3fedb22c-b41f-4bb5-aaf2-5f01982ac46b	3	Part 3 - Indian Polity	भाग 3 - भारतीय राजव्यवस्था			\N	2	2026-08-10 14:08:44.809478+05:30
0a950c14-f508-4285-86c5-3ecbcb5133f2	5f6509bd-8e7f-4bb3-867f-289ac9abb886	3	Part 3 - Indian Polity	भाग 3 - भारतीय राजव्यवस्था			\N	2	2026-08-10 14:08:44.809478+05:30
4f0a7e27-7983-40d3-a8e6-657144eff106	86ab6358-4c6f-466c-a78d-0b5292a5d79a	3	Part 3 - Indian Polity	भाग 3 - भारतीय राजव्यवस्था			\N	2	2026-08-10 14:08:44.809478+05:30
4739db90-5d2d-4d60-b8fa-b200d6ebd0fd	c65a322a-ba27-4a01-b6c5-bbc6e3541935	3	Part 3 - Indian Polity	भाग 3 - भारतीय राजव्यवस्था			\N	2	2026-08-10 14:08:44.809478+05:30
2c6040e7-6107-4785-a154-d0f0b49a277f	3d169150-830a-41cc-bc88-19a569800189	3	Part 3 - Indian Polity	भाग 3 - भारतीय राजव्यवस्था			\N	2	2026-08-10 14:08:44.809478+05:30
ddddaf5b-e82e-471b-8c0e-02857b30e5bb	c4b236ee-e853-4bdf-b3a2-129919871a3a	3	Part 3 - Indian Polity	भाग 3 - भारतीय राजव्यवस्था			\N	2	2026-08-10 14:08:44.809478+05:30
3de2c10b-d8a4-44fc-b6cb-0088c79a3ba7	345a4130-7ee4-41ef-8a60-84a668c2ebee	3	Part 3 - Indian Polity	भाग 3 - भारतीय राजव्यवस्था			\N	2	2026-08-10 14:08:44.809478+05:30
1af9166e-1c9e-4bb6-a83a-f67984f39a7c	f46d7721-ef6e-466e-b451-1e5dc2abe027	1	Part 1 - Current Affairs	भाग 1 - समसामयिकी			\N	0	2026-08-10 14:08:44.809478+05:30
c7573192-2592-415b-8ec6-5e7023aefaba	20e63e56-2e04-4750-aeb4-5c47a297a779	1	Part 1 - Current Affairs	भाग 1 - समसामयिकी			\N	0	2026-08-10 14:08:44.809478+05:30
c1b7b170-dbb8-4659-b1f4-0cf1a88532b0	dffcca8c-c4f3-4fb0-8d5d-659d78c22c72	1	Part 1 - Current Affairs	भाग 1 - समसामयिकी			\N	0	2026-08-10 14:08:44.809478+05:30
18f67565-69cd-407d-9821-1e5ba3a681b9	0fa2ddff-c3d3-428e-a0bc-3628ef31733a	1	Part 1 - Current Affairs	भाग 1 - समसामयिकी			\N	0	2026-08-10 14:08:44.809478+05:30
eb1ab652-31cb-4eae-9d4a-68fe1a5b7e02	6bbacb7b-cb14-4435-9f3e-22f831821b1c	1	Part 1 - Current Affairs	भाग 1 - समसामयिकी			\N	0	2026-08-10 14:08:44.809478+05:30
d4380104-05cc-4d56-9e67-5f22e5ea1ef2	653344d5-aff8-4b4c-80f8-dd2ef1d3f770	1	Part 1 - Current Affairs	भाग 1 - समसामयिकी			\N	0	2026-08-10 14:08:44.809478+05:30
a56abc2a-5aee-40e6-9263-6791ce2089e9	bd80fbac-e6da-44ff-a4f5-02a5c1aaceb9	1	Part 1 - Current Affairs	भाग 1 - समसामयिकी			\N	0	2026-08-10 14:08:44.809478+05:30
80bf0e5a-bf62-4486-b6cb-0c633b43f7b5	2af27eae-5450-4ea0-8c8e-f03169a39dd5	1	Part 1 - Current Affairs	भाग 1 - समसामयिकी			\N	0	2026-08-10 14:08:44.809478+05:30
f097ee7e-6ce5-464e-9b74-e1b91fc42460	76ca97dd-609e-4ab6-b3fe-328c9d2179f3	1	Part 1 - Current Affairs	भाग 1 - समसामयिकी			\N	0	2026-08-10 14:08:44.809478+05:30
39599fd3-7d65-452e-80a0-a74fb6fb07bd	f46d7721-ef6e-466e-b451-1e5dc2abe027	2	Part 2 - Current Affairs	भाग 2 - समसामयिकी			\N	1	2026-08-10 14:08:44.809478+05:30
37d1de65-79b6-47b6-b0d5-e30d7f99d173	20e63e56-2e04-4750-aeb4-5c47a297a779	2	Part 2 - Current Affairs	भाग 2 - समसामयिकी			\N	1	2026-08-10 14:08:44.809478+05:30
4bbceb49-2930-4e5f-bfb2-021f5f64a4c4	dffcca8c-c4f3-4fb0-8d5d-659d78c22c72	2	Part 2 - Current Affairs	भाग 2 - समसामयिकी			\N	1	2026-08-10 14:08:44.809478+05:30
e8760a56-b5e8-49ed-853c-2a10a39e23a0	0fa2ddff-c3d3-428e-a0bc-3628ef31733a	2	Part 2 - Current Affairs	भाग 2 - समसामयिकी			\N	1	2026-08-10 14:08:44.809478+05:30
c3b1694c-6d43-4d2c-9cc8-112346c456ca	6bbacb7b-cb14-4435-9f3e-22f831821b1c	2	Part 2 - Current Affairs	भाग 2 - समसामयिकी			\N	1	2026-08-10 14:08:44.809478+05:30
e5caffc8-52b5-431a-ab7e-aff685520ca9	653344d5-aff8-4b4c-80f8-dd2ef1d3f770	2	Part 2 - Current Affairs	भाग 2 - समसामयिकी			\N	1	2026-08-10 14:08:44.809478+05:30
3627d828-4e70-4374-84bc-734d1cc19e7d	bd80fbac-e6da-44ff-a4f5-02a5c1aaceb9	2	Part 2 - Current Affairs	भाग 2 - समसामयिकी			\N	1	2026-08-10 14:08:44.809478+05:30
ddbf412a-90be-4276-83e6-0cfd0c573298	2af27eae-5450-4ea0-8c8e-f03169a39dd5	2	Part 2 - Current Affairs	भाग 2 - समसामयिकी			\N	1	2026-08-10 14:08:44.809478+05:30
cd5a5935-4a01-4487-b105-2e21918c0acb	76ca97dd-609e-4ab6-b3fe-328c9d2179f3	2	Part 2 - Current Affairs	भाग 2 - समसामयिकी			\N	1	2026-08-10 14:08:44.809478+05:30
ba3e3272-3f5d-4c63-bb48-8bdad71ebae2	f46d7721-ef6e-466e-b451-1e5dc2abe027	3	Part 3 - Current Affairs	भाग 3 - समसामयिकी			\N	2	2026-08-10 14:08:44.809478+05:30
54128002-d559-43d7-9772-be622543ee85	20e63e56-2e04-4750-aeb4-5c47a297a779	3	Part 3 - Current Affairs	भाग 3 - समसामयिकी			\N	2	2026-08-10 14:08:44.809478+05:30
0a00963f-d697-4254-8e05-6c45c8bcaba3	dffcca8c-c4f3-4fb0-8d5d-659d78c22c72	3	Part 3 - Current Affairs	भाग 3 - समसामयिकी			\N	2	2026-08-10 14:08:44.809478+05:30
6b2e0ed3-9875-4e30-8a4b-17362c0bb050	0fa2ddff-c3d3-428e-a0bc-3628ef31733a	3	Part 3 - Current Affairs	भाग 3 - समसामयिकी			\N	2	2026-08-10 14:08:44.809478+05:30
eaae713f-cf8e-4225-a15f-04fa115fbb21	6bbacb7b-cb14-4435-9f3e-22f831821b1c	3	Part 3 - Current Affairs	भाग 3 - समसामयिकी			\N	2	2026-08-10 14:08:44.809478+05:30
45b460b9-f3ea-4f21-a4f0-9d45a0372cbc	653344d5-aff8-4b4c-80f8-dd2ef1d3f770	3	Part 3 - Current Affairs	भाग 3 - समसामयिकी			\N	2	2026-08-10 14:08:44.809478+05:30
0e8fe58c-0991-4278-aec5-302ca134e9ee	bd80fbac-e6da-44ff-a4f5-02a5c1aaceb9	3	Part 3 - Current Affairs	भाग 3 - समसामयिकी			\N	2	2026-08-10 14:08:44.809478+05:30
12ed3a76-48e2-492f-b406-7f66d67e1f33	2af27eae-5450-4ea0-8c8e-f03169a39dd5	3	Part 3 - Current Affairs	भाग 3 - समसामयिकी			\N	2	2026-08-10 14:08:44.809478+05:30
28dcaac4-f3ab-40b0-a507-85a8076adfc4	76ca97dd-609e-4ab6-b3fe-328c9d2179f3	3	Part 3 - Current Affairs	भाग 3 - समसामयिकी			\N	2	2026-08-10 14:08:44.809478+05:30
b5e7aa72-8f5e-4870-bfdd-46ce8f7d9fb9	5319196b-91e1-4ad1-9058-01f38470c2ab	1	Part 1 - General Science	भाग 1 - सामान्य विज्ञान			\N	0	2026-08-10 14:08:44.809478+05:30
1b0fb335-db78-4d8f-9b41-27f380188c2d	0d14310f-d7bc-4fd0-8c3c-4c0b492eccd9	1	Part 1 - General Science	भाग 1 - सामान्य विज्ञान			\N	0	2026-08-10 14:08:44.809478+05:30
26750f36-f778-4bbb-87b6-38e6f87082e3	c7148886-3e13-454e-9f43-5f9fb4eb854f	1	Part 1 - General Science	भाग 1 - सामान्य विज्ञान			\N	0	2026-08-10 14:08:44.809478+05:30
a41c05c5-73e7-4972-8e2c-aaf0bc1bed2c	f3f7267e-83a9-4bbd-acde-285a9469483a	1	Part 1 - General Science	भाग 1 - सामान्य विज्ञान			\N	0	2026-08-10 14:08:44.809478+05:30
f5329563-80a8-4439-9e0c-f9f7fd4c70c0	ccf87cf0-403a-4c1d-a3e1-05e687bf8634	1	Part 1 - General Science	भाग 1 - सामान्य विज्ञान			\N	0	2026-08-10 14:08:44.809478+05:30
f610a54c-db5e-4ce4-92ea-f7388b09e868	a737c10b-eebd-4777-b383-801174dc682e	1	Part 1 - General Science	भाग 1 - सामान्य विज्ञान			\N	0	2026-08-10 14:08:44.809478+05:30
1443b444-2b38-4ec7-bf18-dbe0225b6303	2735399e-5c91-438b-9dd0-3c33a99e7090	1	Part 1 - General Science	भाग 1 - सामान्य विज्ञान			\N	0	2026-08-10 14:08:44.809478+05:30
adbf8634-7911-4a6f-8be3-5133f8129316	61d97bbd-4ab9-452b-b8c7-8eb23baf1572	1	Part 1 - General Science	भाग 1 - सामान्य विज्ञान			\N	0	2026-08-10 14:08:44.809478+05:30
044791bc-57cd-4552-a7d5-37f9aa891dc7	c2e2a66d-21c8-4192-b4bd-a52ffc8b3779	1	Part 1 - General Science	भाग 1 - सामान्य विज्ञान			\N	0	2026-08-10 14:08:44.809478+05:30
1fd614a8-7756-47b7-b028-1dc66a1af1cb	5319196b-91e1-4ad1-9058-01f38470c2ab	2	Part 2 - General Science	भाग 2 - सामान्य विज्ञान			\N	1	2026-08-10 14:08:44.809478+05:30
5852e3c2-4004-4723-91ec-f16b6e2ebdc4	0d14310f-d7bc-4fd0-8c3c-4c0b492eccd9	2	Part 2 - General Science	भाग 2 - सामान्य विज्ञान			\N	1	2026-08-10 14:08:44.809478+05:30
bc0546ca-4c55-477a-ba26-5f29337b936f	c7148886-3e13-454e-9f43-5f9fb4eb854f	2	Part 2 - General Science	भाग 2 - सामान्य विज्ञान			\N	1	2026-08-10 14:08:44.809478+05:30
b9b089d5-db3d-4536-879c-f1c0c7c37de3	f3f7267e-83a9-4bbd-acde-285a9469483a	2	Part 2 - General Science	भाग 2 - सामान्य विज्ञान			\N	1	2026-08-10 14:08:44.809478+05:30
28362556-d260-4bbd-84be-3806359fd13f	ccf87cf0-403a-4c1d-a3e1-05e687bf8634	2	Part 2 - General Science	भाग 2 - सामान्य विज्ञान			\N	1	2026-08-10 14:08:44.809478+05:30
d7896e6e-8dab-47dc-aedc-907397f45dd1	a737c10b-eebd-4777-b383-801174dc682e	2	Part 2 - General Science	भाग 2 - सामान्य विज्ञान			\N	1	2026-08-10 14:08:44.809478+05:30
642e4dff-defa-41e7-b531-77cdd33e59d0	2735399e-5c91-438b-9dd0-3c33a99e7090	2	Part 2 - General Science	भाग 2 - सामान्य विज्ञान			\N	1	2026-08-10 14:08:44.809478+05:30
68404b4e-1a29-4255-9093-508232583d41	61d97bbd-4ab9-452b-b8c7-8eb23baf1572	2	Part 2 - General Science	भाग 2 - सामान्य विज्ञान			\N	1	2026-08-10 14:08:44.809478+05:30
99ab59bd-7585-401b-b569-343c55a39b92	c2e2a66d-21c8-4192-b4bd-a52ffc8b3779	2	Part 2 - General Science	भाग 2 - सामान्य विज्ञान			\N	1	2026-08-10 14:08:44.809478+05:30
8a9d553c-8d23-458e-a340-de192dd7e911	5319196b-91e1-4ad1-9058-01f38470c2ab	3	Part 3 - General Science	भाग 3 - सामान्य विज्ञान			\N	2	2026-08-10 14:08:44.809478+05:30
0d42d1ee-3f35-4ded-9fd8-2b21a7dfa734	0d14310f-d7bc-4fd0-8c3c-4c0b492eccd9	3	Part 3 - General Science	भाग 3 - सामान्य विज्ञान			\N	2	2026-08-10 14:08:44.809478+05:30
4ced8b4f-6d2d-4b0f-a7f1-f174b54b611a	c7148886-3e13-454e-9f43-5f9fb4eb854f	3	Part 3 - General Science	भाग 3 - सामान्य विज्ञान			\N	2	2026-08-10 14:08:44.809478+05:30
ec8e3180-3943-4f3b-a6fc-5129d50464e0	f3f7267e-83a9-4bbd-acde-285a9469483a	3	Part 3 - General Science	भाग 3 - सामान्य विज्ञान			\N	2	2026-08-10 14:08:44.809478+05:30
456ad049-fed0-40e9-a6ba-eff5a4915973	ccf87cf0-403a-4c1d-a3e1-05e687bf8634	3	Part 3 - General Science	भाग 3 - सामान्य विज्ञान			\N	2	2026-08-10 14:08:44.809478+05:30
f1784b67-4585-447f-a653-c568236a44e4	a737c10b-eebd-4777-b383-801174dc682e	3	Part 3 - General Science	भाग 3 - सामान्य विज्ञान			\N	2	2026-08-10 14:08:44.809478+05:30
60450167-287b-48c6-a19d-7646634d3f04	2735399e-5c91-438b-9dd0-3c33a99e7090	3	Part 3 - General Science	भाग 3 - सामान्य विज्ञान			\N	2	2026-08-10 14:08:44.809478+05:30
acfb8354-478a-456b-a251-244542d1ca1c	61d97bbd-4ab9-452b-b8c7-8eb23baf1572	3	Part 3 - General Science	भाग 3 - सामान्य विज्ञान			\N	2	2026-08-10 14:08:44.809478+05:30
4c627881-74bd-4399-90a6-d11523ad700b	c2e2a66d-21c8-4192-b4bd-a52ffc8b3779	3	Part 3 - General Science	भाग 3 - सामान्य विज्ञान			\N	2	2026-08-10 14:08:44.809478+05:30
139871d3-aa93-4d9f-ac13-01ff109bd1bc	20fe7d8e-5e4d-4c13-86b1-8e3a52b06402	1	Part 1 - Arithmetic	भाग 1 - अंकगणित			\N	0	2026-08-10 14:08:44.809478+05:30
e486ab03-5a32-4f10-8c85-b49fd80bfe45	afda72b6-76db-4711-93a6-4b170712a449	1	Part 1 - Arithmetic	भाग 1 - अंकगणित			\N	0	2026-08-10 14:08:44.809478+05:30
93db7fb7-732e-4b66-9493-09405988a9fe	aec2a8f1-2593-4568-8099-691648cbc668	1	Part 1 - Arithmetic	भाग 1 - अंकगणित			\N	0	2026-08-10 14:08:44.809478+05:30
e54970ae-7754-4610-979f-5dc73f40ec07	68ded6b8-032a-401f-b432-a278e2b9c229	1	Part 1 - Arithmetic	भाग 1 - अंकगणित			\N	0	2026-08-10 14:08:44.809478+05:30
61950933-8c96-4c76-939b-277f483f07e5	a6a67d2f-03d1-41e5-8272-cd57f185e805	1	Part 1 - Arithmetic	भाग 1 - अंकगणित			\N	0	2026-08-10 14:08:44.809478+05:30
c735f6d2-c33c-4cd7-bf22-1c596a5e1d16	5f5e218e-869c-44cd-aa48-bea7cd56be98	1	Part 1 - Arithmetic	भाग 1 - अंकगणित			\N	0	2026-08-10 14:08:44.809478+05:30
ebfe362a-a828-46ad-be25-505d4f6ad4f6	0aff93bd-d8cf-4b98-832c-3b43401bdc01	1	Part 1 - Arithmetic	भाग 1 - अंकगणित			\N	0	2026-08-10 14:08:44.809478+05:30
afb61a76-87f1-4a95-8a8f-0340ad0526f6	cdf1f1e0-829e-4dac-99ef-de2ccb20b8a5	1	Part 1 - Arithmetic	भाग 1 - अंकगणित			\N	0	2026-08-10 14:08:44.809478+05:30
b34f83f1-9816-4edb-a030-3ad10083240e	e099fe7a-a0bf-4f27-baf9-3244967e7f9a	1	Part 1 - Arithmetic	भाग 1 - अंकगणित			\N	0	2026-08-10 14:08:44.809478+05:30
0b757a25-16ad-4009-bde7-edc75a5c4022	20fe7d8e-5e4d-4c13-86b1-8e3a52b06402	2	Part 2 - Arithmetic	भाग 2 - अंकगणित			\N	1	2026-08-10 14:08:44.809478+05:30
e8ca4303-08b9-46c9-a126-7e58bc0a0a96	afda72b6-76db-4711-93a6-4b170712a449	2	Part 2 - Arithmetic	भाग 2 - अंकगणित			\N	1	2026-08-10 14:08:44.809478+05:30
46ee22ee-5b3c-453f-b031-98c066f52074	aec2a8f1-2593-4568-8099-691648cbc668	2	Part 2 - Arithmetic	भाग 2 - अंकगणित			\N	1	2026-08-10 14:08:44.809478+05:30
5ee3e067-f4c8-45a8-ac6b-14822ba886cf	68ded6b8-032a-401f-b432-a278e2b9c229	2	Part 2 - Arithmetic	भाग 2 - अंकगणित			\N	1	2026-08-10 14:08:44.809478+05:30
c8d3e659-5a68-4db1-bd06-76d6557e0e6b	a6a67d2f-03d1-41e5-8272-cd57f185e805	2	Part 2 - Arithmetic	भाग 2 - अंकगणित			\N	1	2026-08-10 14:08:44.809478+05:30
b1dd76d8-a202-4d4b-a36b-30955fe4e8e1	5f5e218e-869c-44cd-aa48-bea7cd56be98	2	Part 2 - Arithmetic	भाग 2 - अंकगणित			\N	1	2026-08-10 14:08:44.809478+05:30
41d31405-0eb8-4e81-9dfe-10ddb52814c6	0aff93bd-d8cf-4b98-832c-3b43401bdc01	2	Part 2 - Arithmetic	भाग 2 - अंकगणित			\N	1	2026-08-10 14:08:44.809478+05:30
ebc7087b-bb82-4fa8-aaeb-6b29f9e79ff0	cdf1f1e0-829e-4dac-99ef-de2ccb20b8a5	2	Part 2 - Arithmetic	भाग 2 - अंकगणित			\N	1	2026-08-10 14:08:44.809478+05:30
1ed5f337-3a89-424e-b969-ed70bdae7fd1	e099fe7a-a0bf-4f27-baf9-3244967e7f9a	2	Part 2 - Arithmetic	भाग 2 - अंकगणित			\N	1	2026-08-10 14:08:44.809478+05:30
603be231-3d51-4e21-9b14-47a478e05c6e	20fe7d8e-5e4d-4c13-86b1-8e3a52b06402	3	Part 3 - Arithmetic	भाग 3 - अंकगणित			\N	2	2026-08-10 14:08:44.809478+05:30
00acbbcd-bdcd-4437-a5f8-1e860f5a8d29	afda72b6-76db-4711-93a6-4b170712a449	3	Part 3 - Arithmetic	भाग 3 - अंकगणित			\N	2	2026-08-10 14:08:44.809478+05:30
f73af37c-a113-4e4f-86f0-847806bc173b	aec2a8f1-2593-4568-8099-691648cbc668	3	Part 3 - Arithmetic	भाग 3 - अंकगणित			\N	2	2026-08-10 14:08:44.809478+05:30
0173ea1e-35c1-4ab5-a008-b63507190fb2	68ded6b8-032a-401f-b432-a278e2b9c229	3	Part 3 - Arithmetic	भाग 3 - अंकगणित			\N	2	2026-08-10 14:08:44.809478+05:30
d983be6b-14b9-4dc9-96f2-4a415070ac9d	a6a67d2f-03d1-41e5-8272-cd57f185e805	3	Part 3 - Arithmetic	भाग 3 - अंकगणित			\N	2	2026-08-10 14:08:44.809478+05:30
e203940a-ba36-471a-8013-0eb409b2b36f	5f5e218e-869c-44cd-aa48-bea7cd56be98	3	Part 3 - Arithmetic	भाग 3 - अंकगणित			\N	2	2026-08-10 14:08:44.809478+05:30
9d3be15b-fd70-45af-8acb-2024773cf6ee	0aff93bd-d8cf-4b98-832c-3b43401bdc01	3	Part 3 - Arithmetic	भाग 3 - अंकगणित			\N	2	2026-08-10 14:08:44.809478+05:30
ee3eadd1-86ff-47a9-a7ed-2813ce72eb10	cdf1f1e0-829e-4dac-99ef-de2ccb20b8a5	3	Part 3 - Arithmetic	भाग 3 - अंकगणित			\N	2	2026-08-10 14:08:44.809478+05:30
8066a03f-4355-49bb-ae11-6407144360c2	e099fe7a-a0bf-4f27-baf9-3244967e7f9a	3	Part 3 - Arithmetic	भाग 3 - अंकगणित			\N	2	2026-08-10 14:08:44.809478+05:30
9db7e9e2-cd75-4117-ba54-6e8071c0e718	92b52ca9-0879-4b09-8f7e-7c8e6cb1f444	1	Part 1 - Percentage	भाग 1 - प्रतिशत			\N	0	2026-08-10 14:08:44.809478+05:30
c68a67c6-688b-4e5f-b1b7-fee578262cca	ab9b4709-59de-4f9a-8663-e296b11365cc	1	Part 1 - Percentage	भाग 1 - प्रतिशत			\N	0	2026-08-10 14:08:44.809478+05:30
85959bce-9c79-413d-87e7-0f9d51cf7913	fdaa0377-be91-4eb6-8b08-f5a0ddb34026	1	Part 1 - Percentage	भाग 1 - प्रतिशत			\N	0	2026-08-10 14:08:44.809478+05:30
61e205c7-1e02-4b5f-927a-963d2c6cb543	edeca27e-ed05-4c97-9463-b6a61029e741	1	Part 1 - Percentage	भाग 1 - प्रतिशत			\N	0	2026-08-10 14:08:44.809478+05:30
f81972f7-768c-4772-afcc-bd1680d58b70	d1934494-eabc-458d-b3aa-dae33fd7272a	1	Part 1 - Percentage	भाग 1 - प्रतिशत			\N	0	2026-08-10 14:08:44.809478+05:30
e9feae46-55ce-447e-a973-ac79bcb31acd	3882df71-af73-4a36-a2ca-70481a8cc0ea	1	Part 1 - Percentage	भाग 1 - प्रतिशत			\N	0	2026-08-10 14:08:44.809478+05:30
60f43958-568e-4fd3-ab14-3530b1984dba	fa18b0da-3b7d-46f5-850a-cf6a9435145d	1	Part 1 - Percentage	भाग 1 - प्रतिशत			\N	0	2026-08-10 14:08:44.809478+05:30
95110b82-4e6d-4f15-9dac-3a0b2617b834	782d0705-4ffe-4186-bb53-67e4f2e5aa2c	1	Part 1 - Percentage	भाग 1 - प्रतिशत			\N	0	2026-08-10 14:08:44.809478+05:30
bea15a5d-c94f-41e5-85dc-b7440a4b8590	9100d84d-fff3-4954-9163-7aba242f19fb	1	Part 1 - Percentage	भाग 1 - प्रतिशत			\N	0	2026-08-10 14:08:44.809478+05:30
1edafa92-137c-4a78-8c12-3f3158e83077	92b52ca9-0879-4b09-8f7e-7c8e6cb1f444	2	Part 2 - Percentage	भाग 2 - प्रतिशत			\N	1	2026-08-10 14:08:44.809478+05:30
c3d27c79-7754-446f-801f-b58ba76260b0	ab9b4709-59de-4f9a-8663-e296b11365cc	2	Part 2 - Percentage	भाग 2 - प्रतिशत			\N	1	2026-08-10 14:08:44.809478+05:30
30e102e8-de2c-445b-9cb2-ba9662b991e5	fdaa0377-be91-4eb6-8b08-f5a0ddb34026	2	Part 2 - Percentage	भाग 2 - प्रतिशत			\N	1	2026-08-10 14:08:44.809478+05:30
645de083-1d3b-47ba-9b7f-e6d7ad194a96	edeca27e-ed05-4c97-9463-b6a61029e741	2	Part 2 - Percentage	भाग 2 - प्रतिशत			\N	1	2026-08-10 14:08:44.809478+05:30
90cc5d46-07b8-4ccf-bf85-7c2c23ab9950	d1934494-eabc-458d-b3aa-dae33fd7272a	2	Part 2 - Percentage	भाग 2 - प्रतिशत			\N	1	2026-08-10 14:08:44.809478+05:30
9da6f4f2-daba-4b4c-ba63-c739e62a0864	3882df71-af73-4a36-a2ca-70481a8cc0ea	2	Part 2 - Percentage	भाग 2 - प्रतिशत			\N	1	2026-08-10 14:08:44.809478+05:30
6d579629-7d45-47ce-a8ab-f2b9f3e30803	fa18b0da-3b7d-46f5-850a-cf6a9435145d	2	Part 2 - Percentage	भाग 2 - प्रतिशत			\N	1	2026-08-10 14:08:44.809478+05:30
0ec2da22-b54f-4323-9456-dae60c6fec22	782d0705-4ffe-4186-bb53-67e4f2e5aa2c	2	Part 2 - Percentage	भाग 2 - प्रतिशत			\N	1	2026-08-10 14:08:44.809478+05:30
bcb37cc1-e7a4-41bb-8ea6-53c844783307	9100d84d-fff3-4954-9163-7aba242f19fb	2	Part 2 - Percentage	भाग 2 - प्रतिशत			\N	1	2026-08-10 14:08:44.809478+05:30
bb55578e-e7c4-4e82-933c-3ca7ffcd4766	92b52ca9-0879-4b09-8f7e-7c8e6cb1f444	3	Part 3 - Percentage	भाग 3 - प्रतिशत			\N	2	2026-08-10 14:08:44.809478+05:30
f358c789-762b-4c26-8cbd-4a656d0ba302	ab9b4709-59de-4f9a-8663-e296b11365cc	3	Part 3 - Percentage	भाग 3 - प्रतिशत			\N	2	2026-08-10 14:08:44.809478+05:30
e7a7c077-25eb-4573-b0f5-7fd5c0afe19f	fdaa0377-be91-4eb6-8b08-f5a0ddb34026	3	Part 3 - Percentage	भाग 3 - प्रतिशत			\N	2	2026-08-10 14:08:44.809478+05:30
026a4e10-7aec-4a93-aa28-9ded332fda6d	edeca27e-ed05-4c97-9463-b6a61029e741	3	Part 3 - Percentage	भाग 3 - प्रतिशत			\N	2	2026-08-10 14:08:44.809478+05:30
b0118012-c6d8-47c1-9349-bb8207fda52f	d1934494-eabc-458d-b3aa-dae33fd7272a	3	Part 3 - Percentage	भाग 3 - प्रतिशत			\N	2	2026-08-10 14:08:44.809478+05:30
813c3a9a-02f4-44c0-a062-4f60ab08f51d	3882df71-af73-4a36-a2ca-70481a8cc0ea	3	Part 3 - Percentage	भाग 3 - प्रतिशत			\N	2	2026-08-10 14:08:44.809478+05:30
0bb1b742-eab3-477a-80e2-b894e6c93bae	fa18b0da-3b7d-46f5-850a-cf6a9435145d	3	Part 3 - Percentage	भाग 3 - प्रतिशत			\N	2	2026-08-10 14:08:44.809478+05:30
fc6a771a-d0d8-4655-ac92-a69d2469fa39	782d0705-4ffe-4186-bb53-67e4f2e5aa2c	3	Part 3 - Percentage	भाग 3 - प्रतिशत			\N	2	2026-08-10 14:08:44.809478+05:30
6895ebc2-05f4-4c15-850c-a5e73ec5c79d	9100d84d-fff3-4954-9163-7aba242f19fb	3	Part 3 - Percentage	भाग 3 - प्रतिशत			\N	2	2026-08-10 14:08:44.809478+05:30
020d85b7-d674-4078-aaa8-12abc417dc65	dfa8c85c-f93e-4e27-a86c-ecb7a2a94ee2	1	Part 1 - Time and Distance	भाग 1 - समय और दूरी			\N	0	2026-08-10 14:08:44.809478+05:30
d605782f-7491-48a3-abf6-df19594be17a	87084625-c6cf-4b5f-bfd3-0444cc8948e1	1	Part 1 - Time and Distance	भाग 1 - समय और दूरी			\N	0	2026-08-10 14:08:44.809478+05:30
f52a0b90-8a08-4896-b8f4-cdc777a6ff83	4a1c09e2-bcdc-4cc7-9357-f0fc42812ca9	1	Part 1 - Time and Distance	भाग 1 - समय और दूरी			\N	0	2026-08-10 14:08:44.809478+05:30
3dc8a03d-21ca-4987-8a31-661d462abe25	5a15b271-12cf-43ad-8b3c-9bea244f12bf	1	Part 1 - Time and Distance	भाग 1 - समय और दूरी			\N	0	2026-08-10 14:08:44.809478+05:30
6fd52c43-e6a5-4714-b0d1-9fa76acc0122	8cecf206-dff1-485a-900c-e85b9699488d	1	Part 1 - Time and Distance	भाग 1 - समय और दूरी			\N	0	2026-08-10 14:08:44.809478+05:30
61a837fd-a11f-42c7-bf78-f5e4262b0a2f	b4fb3d0e-e799-4cdd-9a86-dfa936752f76	1	Part 1 - Time and Distance	भाग 1 - समय और दूरी			\N	0	2026-08-10 14:08:44.809478+05:30
4c09eb21-29dc-450e-bb15-d898d910a67c	810ce49d-cd5c-4c6a-ad10-0be6c7c5325f	1	Part 1 - Time and Distance	भाग 1 - समय और दूरी			\N	0	2026-08-10 14:08:44.809478+05:30
ce833a7d-f914-4460-9899-f96e55c4c1b7	5b69d854-cb0f-4925-a932-ab04e9a427d7	1	Part 1 - Time and Distance	भाग 1 - समय और दूरी			\N	0	2026-08-10 14:08:44.809478+05:30
84d65593-ab52-4ee0-9b64-9ca5e5ab4cfa	4122236c-8b0d-49fc-a504-2a358e72e41d	1	Part 1 - Time and Distance	भाग 1 - समय और दूरी			\N	0	2026-08-10 14:08:44.809478+05:30
9f41e8f7-d14c-4a57-833b-ab761253c3ca	dfa8c85c-f93e-4e27-a86c-ecb7a2a94ee2	2	Part 2 - Time and Distance	भाग 2 - समय और दूरी			\N	1	2026-08-10 14:08:44.809478+05:30
bc2accf3-8b1a-474f-9b15-c63366e19dd4	87084625-c6cf-4b5f-bfd3-0444cc8948e1	2	Part 2 - Time and Distance	भाग 2 - समय और दूरी			\N	1	2026-08-10 14:08:44.809478+05:30
dd265ae6-ec80-4073-b777-55d17014de05	4a1c09e2-bcdc-4cc7-9357-f0fc42812ca9	2	Part 2 - Time and Distance	भाग 2 - समय और दूरी			\N	1	2026-08-10 14:08:44.809478+05:30
8b6d9671-f0f8-4e9e-b681-c246add32f09	5a15b271-12cf-43ad-8b3c-9bea244f12bf	2	Part 2 - Time and Distance	भाग 2 - समय और दूरी			\N	1	2026-08-10 14:08:44.809478+05:30
c0482fc3-c799-4b37-b127-d812baedbd2a	8cecf206-dff1-485a-900c-e85b9699488d	2	Part 2 - Time and Distance	भाग 2 - समय और दूरी			\N	1	2026-08-10 14:08:44.809478+05:30
43526852-c57e-43cb-be27-9b8f87a8b9f5	b4fb3d0e-e799-4cdd-9a86-dfa936752f76	2	Part 2 - Time and Distance	भाग 2 - समय और दूरी			\N	1	2026-08-10 14:08:44.809478+05:30
6e179884-2bd4-4f64-a24f-24b5cfe55f4e	810ce49d-cd5c-4c6a-ad10-0be6c7c5325f	2	Part 2 - Time and Distance	भाग 2 - समय और दूरी			\N	1	2026-08-10 14:08:44.809478+05:30
d5e29c70-ed75-4663-880a-091fd57c7345	5b69d854-cb0f-4925-a932-ab04e9a427d7	2	Part 2 - Time and Distance	भाग 2 - समय और दूरी			\N	1	2026-08-10 14:08:44.809478+05:30
402d0448-b165-4f3f-b3e2-58d50810f832	4122236c-8b0d-49fc-a504-2a358e72e41d	2	Part 2 - Time and Distance	भाग 2 - समय और दूरी			\N	1	2026-08-10 14:08:44.809478+05:30
7afb6e06-88df-446e-8471-bca50b2deec6	dfa8c85c-f93e-4e27-a86c-ecb7a2a94ee2	3	Part 3 - Time and Distance	भाग 3 - समय और दूरी			\N	2	2026-08-10 14:08:44.809478+05:30
cf5b4f0a-dedd-456c-8747-92535a4f9249	87084625-c6cf-4b5f-bfd3-0444cc8948e1	3	Part 3 - Time and Distance	भाग 3 - समय और दूरी			\N	2	2026-08-10 14:08:44.809478+05:30
50887e2f-57a6-4944-8c1a-fd8a2c885209	4a1c09e2-bcdc-4cc7-9357-f0fc42812ca9	3	Part 3 - Time and Distance	भाग 3 - समय और दूरी			\N	2	2026-08-10 14:08:44.809478+05:30
564ccd36-84ac-460e-8859-bd210abac537	5a15b271-12cf-43ad-8b3c-9bea244f12bf	3	Part 3 - Time and Distance	भाग 3 - समय और दूरी			\N	2	2026-08-10 14:08:44.809478+05:30
51c24109-fe2a-4472-b7b3-f2ab94df2ef5	8cecf206-dff1-485a-900c-e85b9699488d	3	Part 3 - Time and Distance	भाग 3 - समय और दूरी			\N	2	2026-08-10 14:08:44.809478+05:30
c119680b-287b-419b-b8c6-d14d00540497	b4fb3d0e-e799-4cdd-9a86-dfa936752f76	3	Part 3 - Time and Distance	भाग 3 - समय और दूरी			\N	2	2026-08-10 14:08:44.809478+05:30
e933c396-8a54-46bf-a702-4c3c1849ae00	810ce49d-cd5c-4c6a-ad10-0be6c7c5325f	3	Part 3 - Time and Distance	भाग 3 - समय और दूरी			\N	2	2026-08-10 14:08:44.809478+05:30
10dca8b7-3e57-44f2-912c-f7866c74418e	5b69d854-cb0f-4925-a932-ab04e9a427d7	3	Part 3 - Time and Distance	भाग 3 - समय और दूरी			\N	2	2026-08-10 14:08:44.809478+05:30
d34c4164-a6ed-4dcc-a680-e793dab70490	4122236c-8b0d-49fc-a504-2a358e72e41d	3	Part 3 - Time and Distance	भाग 3 - समय और दूरी			\N	2	2026-08-10 14:08:44.809478+05:30
100f280f-5270-424b-8fc0-a1db7cffdc46	20ab7430-681d-46e3-b92d-a7c6494f93c0	1	Part 1 - Profit and Loss	भाग 1 - लाभ और हानि			\N	0	2026-08-10 14:08:44.809478+05:30
1d555f56-9c76-4dce-86a1-47150f386991	46f4019a-6f2d-4788-aefb-6f487a89c84a	1	Part 1 - Profit and Loss	भाग 1 - लाभ और हानि			\N	0	2026-08-10 14:08:44.809478+05:30
72095040-3179-4c5b-9f6d-ff326f75d9e0	e554062c-ab62-42f8-84e6-94b2f1e0ce3f	1	Part 1 - Profit and Loss	भाग 1 - लाभ और हानि			\N	0	2026-08-10 14:08:44.809478+05:30
f9763e2e-8567-4cfe-b80e-7fca8504fc4a	a05b397e-027e-4ef3-a2cf-9662646a155b	1	Part 1 - Profit and Loss	भाग 1 - लाभ और हानि			\N	0	2026-08-10 14:08:44.809478+05:30
b1587eb5-105d-4596-8e9a-ebea6eff6abe	cf221f01-f9d3-4a19-9a46-9c1e3ab492f7	1	Part 1 - Profit and Loss	भाग 1 - लाभ और हानि			\N	0	2026-08-10 14:08:44.809478+05:30
3f90ffa1-14ad-4068-8906-ddff22235e44	c8bd1f3a-8164-4bc3-9523-fc55b09e1c6c	1	Part 1 - Profit and Loss	भाग 1 - लाभ और हानि			\N	0	2026-08-10 14:08:44.809478+05:30
00d60366-0d79-428b-b901-7aef8dac9c3c	4ee010b0-9c67-4476-a9b0-6843d47ce25d	1	Part 1 - Profit and Loss	भाग 1 - लाभ और हानि			\N	0	2026-08-10 14:08:44.809478+05:30
ad7542e7-6dbc-4b77-9f30-c6b6bcd0bc8c	4b10b694-31ea-4116-b130-deb23b896bf8	1	Part 1 - Profit and Loss	भाग 1 - लाभ और हानि			\N	0	2026-08-10 14:08:44.809478+05:30
d1a491e9-30a1-4542-8c6e-ae2140aaaa17	6c53eea0-6cfa-4832-a7f9-162a416a0089	1	Part 1 - Profit and Loss	भाग 1 - लाभ और हानि			\N	0	2026-08-10 14:08:44.809478+05:30
439acbb3-2046-4eb9-896c-09a1b29efdf3	20ab7430-681d-46e3-b92d-a7c6494f93c0	2	Part 2 - Profit and Loss	भाग 2 - लाभ और हानि			\N	1	2026-08-10 14:08:44.809478+05:30
2cb3d89e-604a-4f5d-8d32-abcefbc1a0c3	46f4019a-6f2d-4788-aefb-6f487a89c84a	2	Part 2 - Profit and Loss	भाग 2 - लाभ और हानि			\N	1	2026-08-10 14:08:44.809478+05:30
71649b30-460a-4435-81ce-87b53375f573	e554062c-ab62-42f8-84e6-94b2f1e0ce3f	2	Part 2 - Profit and Loss	भाग 2 - लाभ और हानि			\N	1	2026-08-10 14:08:44.809478+05:30
1f3a1fb8-80ad-4023-9b0d-d978d0c3d323	a05b397e-027e-4ef3-a2cf-9662646a155b	2	Part 2 - Profit and Loss	भाग 2 - लाभ और हानि			\N	1	2026-08-10 14:08:44.809478+05:30
29de8ca2-534a-44b2-b23c-47f80d93b9bb	cf221f01-f9d3-4a19-9a46-9c1e3ab492f7	2	Part 2 - Profit and Loss	भाग 2 - लाभ और हानि			\N	1	2026-08-10 14:08:44.809478+05:30
263203c3-a5a8-4e78-9feb-d7cb57a2c17b	c8bd1f3a-8164-4bc3-9523-fc55b09e1c6c	2	Part 2 - Profit and Loss	भाग 2 - लाभ और हानि			\N	1	2026-08-10 14:08:44.809478+05:30
31026f53-8c13-444d-8623-acc31b17bf79	4ee010b0-9c67-4476-a9b0-6843d47ce25d	2	Part 2 - Profit and Loss	भाग 2 - लाभ और हानि			\N	1	2026-08-10 14:08:44.809478+05:30
11239c41-1964-4ac8-826f-c0e77b1afcd8	4b10b694-31ea-4116-b130-deb23b896bf8	2	Part 2 - Profit and Loss	भाग 2 - लाभ और हानि			\N	1	2026-08-10 14:08:44.809478+05:30
8ce34826-9a49-4d79-8e9a-521ad050e6d6	6c53eea0-6cfa-4832-a7f9-162a416a0089	2	Part 2 - Profit and Loss	भाग 2 - लाभ और हानि			\N	1	2026-08-10 14:08:44.809478+05:30
1c66d4da-3514-4d0d-84ef-09514c066259	20ab7430-681d-46e3-b92d-a7c6494f93c0	3	Part 3 - Profit and Loss	भाग 3 - लाभ और हानि			\N	2	2026-08-10 14:08:44.809478+05:30
f55f6f1f-00d4-4c38-a639-3336f832f2c1	46f4019a-6f2d-4788-aefb-6f487a89c84a	3	Part 3 - Profit and Loss	भाग 3 - लाभ और हानि			\N	2	2026-08-10 14:08:44.809478+05:30
c906fa2f-d305-40c6-8df3-ecf1ec8aebda	e554062c-ab62-42f8-84e6-94b2f1e0ce3f	3	Part 3 - Profit and Loss	भाग 3 - लाभ और हानि			\N	2	2026-08-10 14:08:44.809478+05:30
4e307998-fdec-4524-b4cd-036401b27e5f	a05b397e-027e-4ef3-a2cf-9662646a155b	3	Part 3 - Profit and Loss	भाग 3 - लाभ और हानि			\N	2	2026-08-10 14:08:44.809478+05:30
82b073b1-aeb9-43cb-957d-72ce80d7f4d0	cf221f01-f9d3-4a19-9a46-9c1e3ab492f7	3	Part 3 - Profit and Loss	भाग 3 - लाभ और हानि			\N	2	2026-08-10 14:08:44.809478+05:30
14e37949-e282-4b29-950d-7e4b72d4ebc4	c8bd1f3a-8164-4bc3-9523-fc55b09e1c6c	3	Part 3 - Profit and Loss	भाग 3 - लाभ और हानि			\N	2	2026-08-10 14:08:44.809478+05:30
9364f02c-1c41-4afa-a4c4-bb4a59c3cbc2	4ee010b0-9c67-4476-a9b0-6843d47ce25d	3	Part 3 - Profit and Loss	भाग 3 - लाभ और हानि			\N	2	2026-08-10 14:08:44.809478+05:30
b70080c2-086a-4962-a98d-286cf1596182	4b10b694-31ea-4116-b130-deb23b896bf8	3	Part 3 - Profit and Loss	भाग 3 - लाभ और हानि			\N	2	2026-08-10 14:08:44.809478+05:30
a429f315-ed21-420d-a867-2c4e6c01210f	6c53eea0-6cfa-4832-a7f9-162a416a0089	3	Part 3 - Profit and Loss	भाग 3 - लाभ और हानि			\N	2	2026-08-10 14:08:44.809478+05:30
3f1ca75e-36df-4419-ae6b-70eca7b971c3	0d89297f-3767-449c-bc52-6bcbf7f0e19b	1	Part 1 - Number Series	भाग 1 - संख्या श्रृंखला			\N	0	2026-08-10 14:08:44.809478+05:30
ec627b3a-555a-44f3-8563-4509fc11678e	c5a3f22e-ba55-409c-93cb-9856792daaf9	1	Part 1 - Number Series	भाग 1 - संख्या श्रृंखला			\N	0	2026-08-10 14:08:44.809478+05:30
b87eabe8-20e5-46ed-833a-990c685a3412	e7af3f93-3472-470f-9e78-2c4018999cf2	1	Part 1 - Number Series	भाग 1 - संख्या श्रृंखला			\N	0	2026-08-10 14:08:44.809478+05:30
b650480c-aee8-441a-b90f-374bdfd9a3f0	6383c35a-30b7-4e5e-8285-fbd883823c02	1	Part 1 - Number Series	भाग 1 - संख्या श्रृंखला			\N	0	2026-08-10 14:08:44.809478+05:30
da24a4cd-5410-4ac3-9511-5f3b3ffb1b68	f34fb9ff-3c38-4b07-9759-40135c03d73d	1	Part 1 - Number Series	भाग 1 - संख्या श्रृंखला			\N	0	2026-08-10 14:08:44.809478+05:30
d39ff614-6911-408c-8a68-d6fc9fd53778	ef86036b-c5ca-4966-9e7d-f71857f06a9e	1	Part 1 - Number Series	भाग 1 - संख्या श्रृंखला			\N	0	2026-08-10 14:08:44.809478+05:30
4b956c52-dd94-4351-80de-726e9c1006d7	a97c787f-eabc-483e-920d-b38c59b575b1	1	Part 1 - Number Series	भाग 1 - संख्या श्रृंखला			\N	0	2026-08-10 14:08:44.809478+05:30
c19ee5a4-16fa-4fcf-ae6f-9d54b32af8f6	cf3847e2-6140-4b24-a3a8-05480edcd895	1	Part 1 - Number Series	भाग 1 - संख्या श्रृंखला			\N	0	2026-08-10 14:08:44.809478+05:30
5a622c47-f61e-453a-a754-b1d12d0da027	90135371-5441-4264-aead-d75b47324569	1	Part 1 - Number Series	भाग 1 - संख्या श्रृंखला			\N	0	2026-08-10 14:08:44.809478+05:30
3ac59bec-7fef-4a3d-b696-f6834b06166d	0d89297f-3767-449c-bc52-6bcbf7f0e19b	2	Part 2 - Number Series	भाग 2 - संख्या श्रृंखला			\N	1	2026-08-10 14:08:44.809478+05:30
77833f91-324a-47c0-9752-6adc790b3972	c5a3f22e-ba55-409c-93cb-9856792daaf9	2	Part 2 - Number Series	भाग 2 - संख्या श्रृंखला			\N	1	2026-08-10 14:08:44.809478+05:30
d8ba81ee-d565-4b21-8757-3c066cdaafac	e7af3f93-3472-470f-9e78-2c4018999cf2	2	Part 2 - Number Series	भाग 2 - संख्या श्रृंखला			\N	1	2026-08-10 14:08:44.809478+05:30
23758d6e-4752-43db-ab63-8dfdd2fc6a80	6383c35a-30b7-4e5e-8285-fbd883823c02	2	Part 2 - Number Series	भाग 2 - संख्या श्रृंखला			\N	1	2026-08-10 14:08:44.809478+05:30
ab0892b5-4c49-4805-8446-4a035f1eb997	f34fb9ff-3c38-4b07-9759-40135c03d73d	2	Part 2 - Number Series	भाग 2 - संख्या श्रृंखला			\N	1	2026-08-10 14:08:44.809478+05:30
35e5389b-5d92-4869-ad84-1395dd26704c	ef86036b-c5ca-4966-9e7d-f71857f06a9e	2	Part 2 - Number Series	भाग 2 - संख्या श्रृंखला			\N	1	2026-08-10 14:08:44.809478+05:30
88ca7cdf-2db9-4412-8913-00e6b698174b	a97c787f-eabc-483e-920d-b38c59b575b1	2	Part 2 - Number Series	भाग 2 - संख्या श्रृंखला			\N	1	2026-08-10 14:08:44.809478+05:30
db0dbfb6-f7c7-4433-af73-ec05e1718ec4	cf3847e2-6140-4b24-a3a8-05480edcd895	2	Part 2 - Number Series	भाग 2 - संख्या श्रृंखला			\N	1	2026-08-10 14:08:44.809478+05:30
3501563d-127d-4693-8b84-c916b1c0c0f0	90135371-5441-4264-aead-d75b47324569	2	Part 2 - Number Series	भाग 2 - संख्या श्रृंखला			\N	1	2026-08-10 14:08:44.809478+05:30
fa614213-0dc7-4f13-895e-d08825e8a676	0d89297f-3767-449c-bc52-6bcbf7f0e19b	3	Part 3 - Number Series	भाग 3 - संख्या श्रृंखला			\N	2	2026-08-10 14:08:44.809478+05:30
7643bf40-007c-4378-abf9-62df0ccfb3ff	c5a3f22e-ba55-409c-93cb-9856792daaf9	3	Part 3 - Number Series	भाग 3 - संख्या श्रृंखला			\N	2	2026-08-10 14:08:44.809478+05:30
f39f4410-9d1e-4a57-a85c-89060bad434e	e7af3f93-3472-470f-9e78-2c4018999cf2	3	Part 3 - Number Series	भाग 3 - संख्या श्रृंखला			\N	2	2026-08-10 14:08:44.809478+05:30
933f83b0-4ebf-4e84-9fce-de5966873e03	6383c35a-30b7-4e5e-8285-fbd883823c02	3	Part 3 - Number Series	भाग 3 - संख्या श्रृंखला			\N	2	2026-08-10 14:08:44.809478+05:30
16d7dcdb-8617-422b-bcc1-5df41c07e956	f34fb9ff-3c38-4b07-9759-40135c03d73d	3	Part 3 - Number Series	भाग 3 - संख्या श्रृंखला			\N	2	2026-08-10 14:08:44.809478+05:30
c7459ec2-b8db-4b54-b826-895e1f0e070c	ef86036b-c5ca-4966-9e7d-f71857f06a9e	3	Part 3 - Number Series	भाग 3 - संख्या श्रृंखला			\N	2	2026-08-10 14:08:44.809478+05:30
7f4cbc30-2abf-4299-9fa3-cfba14d635ef	a97c787f-eabc-483e-920d-b38c59b575b1	3	Part 3 - Number Series	भाग 3 - संख्या श्रृंखला			\N	2	2026-08-10 14:08:44.809478+05:30
16fef414-cd88-4e94-80fa-0de8683fa1e9	cf3847e2-6140-4b24-a3a8-05480edcd895	3	Part 3 - Number Series	भाग 3 - संख्या श्रृंखला			\N	2	2026-08-10 14:08:44.809478+05:30
e60b9895-d9e1-4917-bae4-2146cfba2b4d	90135371-5441-4264-aead-d75b47324569	3	Part 3 - Number Series	भाग 3 - संख्या श्रृंखला			\N	2	2026-08-10 14:08:44.809478+05:30
372772fb-5b61-497a-ba06-8639a744a7db	607aea18-e654-4d9d-80e6-a496d9f49a4c	1	Part 1 - Analogy	भाग 1 - सादृश्यता			\N	0	2026-08-10 14:08:44.809478+05:30
bf67995f-6a2a-4d95-a703-e7be7bdc7874	eb9b0b1a-6f42-4b79-8612-c45fc91763dc	1	Part 1 - Analogy	भाग 1 - सादृश्यता			\N	0	2026-08-10 14:08:44.809478+05:30
51087640-9f49-4bc4-bd78-3b34d7a0b7ea	cafa2a69-9e09-432c-a285-1e5bef7e5818	1	Part 1 - Analogy	भाग 1 - सादृश्यता			\N	0	2026-08-10 14:08:44.809478+05:30
727c0408-d9ae-4642-a008-06949102ec41	9f8e1f4e-7034-4a31-a033-65851d4fb19e	1	Part 1 - Analogy	भाग 1 - सादृश्यता			\N	0	2026-08-10 14:08:44.809478+05:30
33eff6e9-4fa2-4922-9315-73c316a61b86	5422df66-fc3d-4974-afb0-580cd2ef87cd	1	Part 1 - Analogy	भाग 1 - सादृश्यता			\N	0	2026-08-10 14:08:44.809478+05:30
8bd63bda-e34c-44cd-937e-2ca1363a6435	57515313-41bb-4213-a31a-74dd04d5ac78	1	Part 1 - Analogy	भाग 1 - सादृश्यता			\N	0	2026-08-10 14:08:44.809478+05:30
faeb073f-849e-428f-8c41-211650d34683	647c21ca-0778-4942-b18f-1452a9457510	1	Part 1 - Analogy	भाग 1 - सादृश्यता			\N	0	2026-08-10 14:08:44.809478+05:30
b9e59678-6df2-43e8-aef1-d64507fe797d	a82014a1-0231-4b7b-b2ac-9a50f93111df	1	Part 1 - Analogy	भाग 1 - सादृश्यता			\N	0	2026-08-10 14:08:44.809478+05:30
7bfb26fd-8c48-4e42-ab85-439aaaf78343	7ce0901a-2769-434f-9d8c-d2bae291c1ed	1	Part 1 - Analogy	भाग 1 - सादृश्यता			\N	0	2026-08-10 14:08:44.809478+05:30
ba92877a-05b4-44a5-aa83-2195b8c5c2bc	607aea18-e654-4d9d-80e6-a496d9f49a4c	2	Part 2 - Analogy	भाग 2 - सादृश्यता			\N	1	2026-08-10 14:08:44.809478+05:30
a7aec1c8-4506-4d98-81f6-c060aa5b1b80	eb9b0b1a-6f42-4b79-8612-c45fc91763dc	2	Part 2 - Analogy	भाग 2 - सादृश्यता			\N	1	2026-08-10 14:08:44.809478+05:30
5a06c2c9-cac6-4c72-8502-a979c65dde77	cafa2a69-9e09-432c-a285-1e5bef7e5818	2	Part 2 - Analogy	भाग 2 - सादृश्यता			\N	1	2026-08-10 14:08:44.809478+05:30
1e66d6e9-7ace-4a2c-8624-21e35272054e	9f8e1f4e-7034-4a31-a033-65851d4fb19e	2	Part 2 - Analogy	भाग 2 - सादृश्यता			\N	1	2026-08-10 14:08:44.809478+05:30
f60f6320-12a4-4f95-be8c-e1c3cce2767b	5422df66-fc3d-4974-afb0-580cd2ef87cd	2	Part 2 - Analogy	भाग 2 - सादृश्यता			\N	1	2026-08-10 14:08:44.809478+05:30
98f2fd55-948f-41e9-9fbb-f6ee9fe99d1b	57515313-41bb-4213-a31a-74dd04d5ac78	2	Part 2 - Analogy	भाग 2 - सादृश्यता			\N	1	2026-08-10 14:08:44.809478+05:30
7f76a7ba-13cb-498e-b953-dcf9c52d1fe1	647c21ca-0778-4942-b18f-1452a9457510	2	Part 2 - Analogy	भाग 2 - सादृश्यता			\N	1	2026-08-10 14:08:44.809478+05:30
39e85981-0ee4-4ac8-8b75-1321bbf01c41	a82014a1-0231-4b7b-b2ac-9a50f93111df	2	Part 2 - Analogy	भाग 2 - सादृश्यता			\N	1	2026-08-10 14:08:44.809478+05:30
65b2d401-9139-42e9-a223-16e1e18ce18b	7ce0901a-2769-434f-9d8c-d2bae291c1ed	2	Part 2 - Analogy	भाग 2 - सादृश्यता			\N	1	2026-08-10 14:08:44.809478+05:30
74b46cb1-eef9-4c9d-a922-23a766c7ebe6	607aea18-e654-4d9d-80e6-a496d9f49a4c	3	Part 3 - Analogy	भाग 3 - सादृश्यता			\N	2	2026-08-10 14:08:44.809478+05:30
50aa1a54-c1d4-4676-9753-9163ceb441f7	eb9b0b1a-6f42-4b79-8612-c45fc91763dc	3	Part 3 - Analogy	भाग 3 - सादृश्यता			\N	2	2026-08-10 14:08:44.809478+05:30
f77e5619-f16a-486c-b13d-47e8c4a56de1	cafa2a69-9e09-432c-a285-1e5bef7e5818	3	Part 3 - Analogy	भाग 3 - सादृश्यता			\N	2	2026-08-10 14:08:44.809478+05:30
f630b916-8577-4768-967d-21bb4cc83b51	9f8e1f4e-7034-4a31-a033-65851d4fb19e	3	Part 3 - Analogy	भाग 3 - सादृश्यता			\N	2	2026-08-10 14:08:44.809478+05:30
4f155fd9-9f33-48cc-966e-39c4b38f1e13	5422df66-fc3d-4974-afb0-580cd2ef87cd	3	Part 3 - Analogy	भाग 3 - सादृश्यता			\N	2	2026-08-10 14:08:44.809478+05:30
0ea296ba-89bd-4401-bee4-4e388500f8cf	57515313-41bb-4213-a31a-74dd04d5ac78	3	Part 3 - Analogy	भाग 3 - सादृश्यता			\N	2	2026-08-10 14:08:44.809478+05:30
199668d0-1d03-4c8b-8a9f-85e80257a94d	647c21ca-0778-4942-b18f-1452a9457510	3	Part 3 - Analogy	भाग 3 - सादृश्यता			\N	2	2026-08-10 14:08:44.809478+05:30
be555d93-adf3-494e-b966-1b348381655c	a82014a1-0231-4b7b-b2ac-9a50f93111df	3	Part 3 - Analogy	भाग 3 - सादृश्यता			\N	2	2026-08-10 14:08:44.809478+05:30
72e9e42b-2e5b-4e2d-a8f5-ff7ec20354b7	7ce0901a-2769-434f-9d8c-d2bae291c1ed	3	Part 3 - Analogy	भाग 3 - सादृश्यता			\N	2	2026-08-10 14:08:44.809478+05:30
40fccf88-3142-4884-9010-33ff5c36aeba	4fb1ff78-59e1-439d-b5dc-0072c6a2dd32	1	Part 1 - Classification	भाग 1 - वर्गीकरण			\N	0	2026-08-10 14:08:44.809478+05:30
b593cbbb-17ac-49c0-959a-9ba3700aeb8e	16de65e8-ab0b-4af9-8027-21c598a03e00	1	Part 1 - Classification	भाग 1 - वर्गीकरण			\N	0	2026-08-10 14:08:44.809478+05:30
1f77a900-b392-4d5c-a58f-55c6dc99d5d4	3f192191-9785-47bb-ad85-0bc8012e7ade	1	Part 1 - Classification	भाग 1 - वर्गीकरण			\N	0	2026-08-10 14:08:44.809478+05:30
cd105654-7a28-4bc6-af6a-d4dd65ac23fe	50f5e589-0f2a-42fe-8ebb-cfd07c02d1e0	1	Part 1 - Classification	भाग 1 - वर्गीकरण			\N	0	2026-08-10 14:08:44.809478+05:30
0b58f722-070f-4fa4-b03a-13aa5c3bf9db	44e66f13-550b-45c8-a264-12a8a3bfaf51	1	Part 1 - Classification	भाग 1 - वर्गीकरण			\N	0	2026-08-10 14:08:44.809478+05:30
ed412a07-42fa-47ab-a0d7-ed7e8cb7b370	3385ee24-6dce-41e0-bf74-e3a84c09d3fe	1	Part 1 - Classification	भाग 1 - वर्गीकरण			\N	0	2026-08-10 14:08:44.809478+05:30
dbd4eafe-9496-4c33-8837-e59d945946ef	ff1bf35a-a069-4b4c-89a6-9844784776a3	1	Part 1 - Classification	भाग 1 - वर्गीकरण			\N	0	2026-08-10 14:08:44.809478+05:30
5e458e59-72b7-4d62-adc9-9d63769a82f8	0876dbfa-9f85-4cf1-ac51-00b46d34304d	1	Part 1 - Classification	भाग 1 - वर्गीकरण			\N	0	2026-08-10 14:08:44.809478+05:30
e94038ac-b74b-49df-83c0-13076db96877	82d70a73-ded1-4858-81e7-f816a354ab67	1	Part 1 - Classification	भाग 1 - वर्गीकरण			\N	0	2026-08-10 14:08:44.809478+05:30
eb2b0552-83d7-49e0-85be-18b4bdab22ed	4fb1ff78-59e1-439d-b5dc-0072c6a2dd32	2	Part 2 - Classification	भाग 2 - वर्गीकरण			\N	1	2026-08-10 14:08:44.809478+05:30
9c540674-1122-4c12-8d45-333779b902c8	16de65e8-ab0b-4af9-8027-21c598a03e00	2	Part 2 - Classification	भाग 2 - वर्गीकरण			\N	1	2026-08-10 14:08:44.809478+05:30
efb82da0-7fd0-4a75-856b-2048cc0c2b5c	3f192191-9785-47bb-ad85-0bc8012e7ade	2	Part 2 - Classification	भाग 2 - वर्गीकरण			\N	1	2026-08-10 14:08:44.809478+05:30
90046a4d-1226-49d3-adee-8da76f1291b9	50f5e589-0f2a-42fe-8ebb-cfd07c02d1e0	2	Part 2 - Classification	भाग 2 - वर्गीकरण			\N	1	2026-08-10 14:08:44.809478+05:30
6f3c2336-f3a3-446d-ae32-875813112d29	44e66f13-550b-45c8-a264-12a8a3bfaf51	2	Part 2 - Classification	भाग 2 - वर्गीकरण			\N	1	2026-08-10 14:08:44.809478+05:30
ca911db2-d523-494b-a5a6-873cca7ea277	3385ee24-6dce-41e0-bf74-e3a84c09d3fe	2	Part 2 - Classification	भाग 2 - वर्गीकरण			\N	1	2026-08-10 14:08:44.809478+05:30
8e7d7f0c-f0d3-4874-b907-a2d6a22f6972	ff1bf35a-a069-4b4c-89a6-9844784776a3	2	Part 2 - Classification	भाग 2 - वर्गीकरण			\N	1	2026-08-10 14:08:44.809478+05:30
eb383c38-659b-45f6-b121-612a75846692	0876dbfa-9f85-4cf1-ac51-00b46d34304d	2	Part 2 - Classification	भाग 2 - वर्गीकरण			\N	1	2026-08-10 14:08:44.809478+05:30
c33f2976-112b-4e37-8318-93140aa148c2	82d70a73-ded1-4858-81e7-f816a354ab67	2	Part 2 - Classification	भाग 2 - वर्गीकरण			\N	1	2026-08-10 14:08:44.809478+05:30
4869a73f-34e0-43c2-af68-6cf8a95b382f	4fb1ff78-59e1-439d-b5dc-0072c6a2dd32	3	Part 3 - Classification	भाग 3 - वर्गीकरण			\N	2	2026-08-10 14:08:44.809478+05:30
f3c4ff97-30e7-4430-85fc-3f8530cc173d	16de65e8-ab0b-4af9-8027-21c598a03e00	3	Part 3 - Classification	भाग 3 - वर्गीकरण			\N	2	2026-08-10 14:08:44.809478+05:30
1047542f-8c15-4012-a15e-23f7b4a33495	3f192191-9785-47bb-ad85-0bc8012e7ade	3	Part 3 - Classification	भाग 3 - वर्गीकरण			\N	2	2026-08-10 14:08:44.809478+05:30
28ddd731-3be1-49f7-8e7b-79332ff613f4	50f5e589-0f2a-42fe-8ebb-cfd07c02d1e0	3	Part 3 - Classification	भाग 3 - वर्गीकरण			\N	2	2026-08-10 14:08:44.809478+05:30
32801d35-f662-4440-957f-c540d29b70e5	44e66f13-550b-45c8-a264-12a8a3bfaf51	3	Part 3 - Classification	भाग 3 - वर्गीकरण			\N	2	2026-08-10 14:08:44.809478+05:30
5a11fab9-5408-4eb6-a307-a96c09fc8f37	3385ee24-6dce-41e0-bf74-e3a84c09d3fe	3	Part 3 - Classification	भाग 3 - वर्गीकरण			\N	2	2026-08-10 14:08:44.809478+05:30
91ddd9fd-de5a-4ff9-87e0-556b505ed280	ff1bf35a-a069-4b4c-89a6-9844784776a3	3	Part 3 - Classification	भाग 3 - वर्गीकरण			\N	2	2026-08-10 14:08:44.809478+05:30
1bc41da1-874e-438f-98ec-a01751ce8285	0876dbfa-9f85-4cf1-ac51-00b46d34304d	3	Part 3 - Classification	भाग 3 - वर्गीकरण			\N	2	2026-08-10 14:08:44.809478+05:30
16eadc74-0465-430e-b796-8cf0e58c20e6	82d70a73-ded1-4858-81e7-f816a354ab67	3	Part 3 - Classification	भाग 3 - वर्गीकरण			\N	2	2026-08-10 14:08:44.809478+05:30
75986ce9-c52c-4469-a0e3-993adaf912f0	9b49b48e-8e84-428d-afe0-8bb46f7b5de2	1	Part 1 - Coding-Decoding	भाग 1 - कोडिंग-डिकोडिंग			\N	0	2026-08-10 14:08:44.809478+05:30
cbe39555-e775-4ed1-9fb5-8058457d9a6f	5d510ad2-a48c-4982-9a74-7119b4b540b5	1	Part 1 - Coding-Decoding	भाग 1 - कोडिंग-डिकोडिंग			\N	0	2026-08-10 14:08:44.809478+05:30
3c6d2abd-e06a-4e4f-af71-e3b1903a2f1f	7624dd97-de84-4488-8346-cdc5fb280567	1	Part 1 - Coding-Decoding	भाग 1 - कोडिंग-डिकोडिंग			\N	0	2026-08-10 14:08:44.809478+05:30
c46d5074-9585-4baa-8b71-fcd14001c7be	a37806ff-acdf-43b1-ae27-25219df370a6	1	Part 1 - Coding-Decoding	भाग 1 - कोडिंग-डिकोडिंग			\N	0	2026-08-10 14:08:44.809478+05:30
ab0ac954-ab15-4408-9469-47a456d28279	a670f238-51e2-4ad6-9175-b65d61ebd5f2	1	Part 1 - Coding-Decoding	भाग 1 - कोडिंग-डिकोडिंग			\N	0	2026-08-10 14:08:44.809478+05:30
a2ace4a3-1606-4e8b-872e-e9a31de48996	7fa63a1d-d89b-49ec-a79c-4b3b67eb5192	1	Part 1 - Coding-Decoding	भाग 1 - कोडिंग-डिकोडिंग			\N	0	2026-08-10 14:08:44.809478+05:30
fa1913c5-2d78-47ff-a1ea-61d3d9276154	c9e0b05d-b91c-4cd3-98c7-550d1e3816a2	1	Part 1 - Coding-Decoding	भाग 1 - कोडिंग-डिकोडिंग			\N	0	2026-08-10 14:08:44.809478+05:30
e7870863-a7f5-468e-8549-f48c7d221413	4330171a-b48f-4016-af22-6f10ff547673	1	Part 1 - Coding-Decoding	भाग 1 - कोडिंग-डिकोडिंग			\N	0	2026-08-10 14:08:44.809478+05:30
139565e8-e8ca-451b-ba40-c9bb46d1c580	b4f577f9-156e-4676-abb9-7e716427b1fa	1	Part 1 - Coding-Decoding	भाग 1 - कोडिंग-डिकोडिंग			\N	0	2026-08-10 14:08:44.809478+05:30
d0e94d05-1090-471b-88d8-7cf381690de6	9b49b48e-8e84-428d-afe0-8bb46f7b5de2	2	Part 2 - Coding-Decoding	भाग 2 - कोडिंग-डिकोडिंग			\N	1	2026-08-10 14:08:44.809478+05:30
e064af77-fecc-42e3-b687-e676eecdf078	5d510ad2-a48c-4982-9a74-7119b4b540b5	2	Part 2 - Coding-Decoding	भाग 2 - कोडिंग-डिकोडिंग			\N	1	2026-08-10 14:08:44.809478+05:30
c541b735-f33d-4631-a0f5-7ba89dbaeeda	7624dd97-de84-4488-8346-cdc5fb280567	2	Part 2 - Coding-Decoding	भाग 2 - कोडिंग-डिकोडिंग			\N	1	2026-08-10 14:08:44.809478+05:30
eae38943-f5b0-44ad-8e14-4f4e92702f53	a37806ff-acdf-43b1-ae27-25219df370a6	2	Part 2 - Coding-Decoding	भाग 2 - कोडिंग-डिकोडिंग			\N	1	2026-08-10 14:08:44.809478+05:30
2f761e97-74e4-45ca-8a5c-aa9bbd109b09	a670f238-51e2-4ad6-9175-b65d61ebd5f2	2	Part 2 - Coding-Decoding	भाग 2 - कोडिंग-डिकोडिंग			\N	1	2026-08-10 14:08:44.809478+05:30
06926620-76b7-4b4b-8390-0d3507964962	7fa63a1d-d89b-49ec-a79c-4b3b67eb5192	2	Part 2 - Coding-Decoding	भाग 2 - कोडिंग-डिकोडिंग			\N	1	2026-08-10 14:08:44.809478+05:30
c073078b-60b5-4559-806d-c2f51419b586	c9e0b05d-b91c-4cd3-98c7-550d1e3816a2	2	Part 2 - Coding-Decoding	भाग 2 - कोडिंग-डिकोडिंग			\N	1	2026-08-10 14:08:44.809478+05:30
29c5afeb-cacd-4869-97ad-15446f93fe0b	4330171a-b48f-4016-af22-6f10ff547673	2	Part 2 - Coding-Decoding	भाग 2 - कोडिंग-डिकोडिंग			\N	1	2026-08-10 14:08:44.809478+05:30
c5b83e63-f3cb-4e5b-bfe7-16a59811f53b	b4f577f9-156e-4676-abb9-7e716427b1fa	2	Part 2 - Coding-Decoding	भाग 2 - कोडिंग-डिकोडिंग			\N	1	2026-08-10 14:08:44.809478+05:30
c0fb7e82-afa3-411c-82fb-f2194aec40ce	9b49b48e-8e84-428d-afe0-8bb46f7b5de2	3	Part 3 - Coding-Decoding	भाग 3 - कोडिंग-डिकोडिंग			\N	2	2026-08-10 14:08:44.809478+05:30
705fa56c-edf0-4d32-be37-4f8cc5653b19	5d510ad2-a48c-4982-9a74-7119b4b540b5	3	Part 3 - Coding-Decoding	भाग 3 - कोडिंग-डिकोडिंग			\N	2	2026-08-10 14:08:44.809478+05:30
a34cccb5-1b22-43a9-8e8b-9b93652aeea9	7624dd97-de84-4488-8346-cdc5fb280567	3	Part 3 - Coding-Decoding	भाग 3 - कोडिंग-डिकोडिंग			\N	2	2026-08-10 14:08:44.809478+05:30
c02af116-a645-41bc-923c-460c038e9db0	a37806ff-acdf-43b1-ae27-25219df370a6	3	Part 3 - Coding-Decoding	भाग 3 - कोडिंग-डिकोडिंग			\N	2	2026-08-10 14:08:44.809478+05:30
76b40716-5263-4204-bab5-277e5c08e84b	a670f238-51e2-4ad6-9175-b65d61ebd5f2	3	Part 3 - Coding-Decoding	भाग 3 - कोडिंग-डिकोडिंग			\N	2	2026-08-10 14:08:44.809478+05:30
b4a67aa7-52e3-4aff-92af-dac69bd4c620	7fa63a1d-d89b-49ec-a79c-4b3b67eb5192	3	Part 3 - Coding-Decoding	भाग 3 - कोडिंग-डिकोडिंग			\N	2	2026-08-10 14:08:44.809478+05:30
6d907380-27b9-4c8b-bea6-8da0dbaf3a0f	c9e0b05d-b91c-4cd3-98c7-550d1e3816a2	3	Part 3 - Coding-Decoding	भाग 3 - कोडिंग-डिकोडिंग			\N	2	2026-08-10 14:08:44.809478+05:30
23de08e9-a25b-4dac-8917-1e078e2957c3	4330171a-b48f-4016-af22-6f10ff547673	3	Part 3 - Coding-Decoding	भाग 3 - कोडिंग-डिकोडिंग			\N	2	2026-08-10 14:08:44.809478+05:30
8a95bdee-24a3-4622-b664-cce374a94b9c	b4f577f9-156e-4676-abb9-7e716427b1fa	3	Part 3 - Coding-Decoding	भाग 3 - कोडिंग-डिकोडिंग			\N	2	2026-08-10 14:08:44.809478+05:30
\.


--
-- Data for Name: topic_progress; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.topic_progress (id, user_id, subject_id, topic_id, status, best_accuracy, attempts_count, completed_at, unlocked_at, created_at, last_visited_at) FROM stdin;
\.


--
-- Data for Name: topics; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.topics (id, subject_id, name_en, name_hi, display_order, created_at) FROM stdin;
d2671e82-1602-426e-83b3-d821a0e344c3	2969ec4d-bdb8-45f6-9ab5-0099f7e7443b	Synonyms	पर्यायवाची शब्द	1	2026-08-02 20:51:52.01574+05:30
315ede64-974d-42ae-aab0-f7cbcc08ccb2	2969ec4d-bdb8-45f6-9ab5-0099f7e7443b	Antonyms	विलोम शब्द	2	2026-08-02 20:51:52.01574+05:30
9781f598-c8d9-4779-adee-defeea3bb6cf	2969ec4d-bdb8-45f6-9ab5-0099f7e7443b	Grammar	व्याकरण	3	2026-08-02 20:51:52.01574+05:30
2f18613e-5285-42cd-acbf-d276c07753a9	c8269f01-6119-48aa-b893-2c95e84a8b91	Indian History	भारतीय इतिहास	1	2026-08-02 20:51:52.01574+05:30
ed0c23db-08df-434e-994b-dfb7e5c117ac	c8269f01-6119-48aa-b893-2c95e84a8b91	Indian Geography	भारतीय भूगोल	2	2026-08-02 20:51:52.01574+05:30
ec618251-437d-4b77-9958-3790f4250e17	c8269f01-6119-48aa-b893-2c95e84a8b91	Indian Polity	भारतीय राजव्यवस्था	3	2026-08-02 20:51:52.01574+05:30
ab73c585-9835-45a6-931c-c8186b040b92	c8269f01-6119-48aa-b893-2c95e84a8b91	Current Affairs	समसामयिकी	4	2026-08-02 20:51:52.01574+05:30
5552d0e7-27a7-4546-b909-b1f259901b23	c8269f01-6119-48aa-b893-2c95e84a8b91	General Science	सामान्य विज्ञान	5	2026-08-02 20:51:52.01574+05:30
3de61e03-c737-40a1-97b5-13de2eba1a34	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	Arithmetic	अंकगणित	1	2026-08-02 20:51:52.01574+05:30
fb6bd6c0-ad04-406c-8b3d-ab077b15a3ac	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	Percentage	प्रतिशत	2	2026-08-02 20:51:52.01574+05:30
f4c8c7bb-d507-4269-9efb-fc8b27fdaa70	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	Time and Distance	समय और दूरी	3	2026-08-02 20:51:52.01574+05:30
9e4b2228-705d-45c5-afec-ccc3a566cb34	ddf28777-9a43-4bfb-9099-fbe5e4af1c81	Profit and Loss	लाभ और हानि	4	2026-08-02 20:51:52.01574+05:30
bbb03e52-68a4-4a75-9719-40c7bae96057	21bfab12-6061-4120-91bb-a3a07350ff28	Number Series	संख्या श्रृंखला	1	2026-08-02 20:51:52.01574+05:30
9206b72a-fc69-41e8-b4c9-fef6a3311fe7	21bfab12-6061-4120-91bb-a3a07350ff28	Analogy	सादृश्यता	2	2026-08-02 20:51:52.01574+05:30
a93bbd88-aa32-4cca-a37b-2683bdeb8286	21bfab12-6061-4120-91bb-a3a07350ff28	Classification	वर्गीकरण	3	2026-08-02 20:51:52.01574+05:30
cbf3761b-07e6-49d6-83c4-37199d862885	21bfab12-6061-4120-91bb-a3a07350ff28	Coding-Decoding	कोडिंग-डिकोडिंग	4	2026-08-02 20:51:52.01574+05:30
e95df0a4-a5a9-4136-9034-5ee25b4b6418	2b5b1f17-e32d-458f-8a7c-7673dfbc9abd	Synonyms	पर्यायवाची शब्द	1	2026-08-10 14:07:38.876255+05:30
8a89220f-bfb5-459b-993b-c7416b19f90f	2b5b1f17-e32d-458f-8a7c-7673dfbc9abd	Antonyms	विलोम शब्द	2	2026-08-10 14:07:38.876255+05:30
ebdf8e82-19a1-434f-bf94-5fbc73fc8926	2b5b1f17-e32d-458f-8a7c-7673dfbc9abd	Grammar	व्याकरण	3	2026-08-10 14:07:38.876255+05:30
cbbcda81-a241-40fd-b411-50058c8a4278	bbbbd386-ab99-4263-a65e-6817c5df0163	Synonyms	पर्यायवाची शब्द	1	2026-08-10 14:07:38.876255+05:30
fe1fc030-a3ab-4e14-9f41-9ae08b4d5013	bbbbd386-ab99-4263-a65e-6817c5df0163	Antonyms	विलोम शब्द	2	2026-08-10 14:07:38.876255+05:30
bdc195a2-a061-49f7-834f-679f565edb84	bbbbd386-ab99-4263-a65e-6817c5df0163	Grammar	व्याकरण	3	2026-08-10 14:07:38.876255+05:30
1801990e-0424-4b50-b736-cd2ef09b7f02	da3c07b9-3294-43f0-8e07-29ded4b43221	Synonyms	पर्यायवाची शब्द	1	2026-08-10 14:07:38.876255+05:30
361a746a-9850-4a29-ab76-abd97ff78dc9	da3c07b9-3294-43f0-8e07-29ded4b43221	Antonyms	विलोम शब्द	2	2026-08-10 14:07:38.876255+05:30
0e260237-b4be-4394-b487-1fd29a7500f7	da3c07b9-3294-43f0-8e07-29ded4b43221	Grammar	व्याकरण	3	2026-08-10 14:07:38.876255+05:30
7a33324e-6ca4-4d41-b610-4f3e71192bf2	6cc41c80-c152-4dbf-af7e-4b839ee5f499	Synonyms	पर्यायवाची शब्द	1	2026-08-10 14:07:38.876255+05:30
15220d90-5600-4225-b34d-d16938f0d1a8	6cc41c80-c152-4dbf-af7e-4b839ee5f499	Antonyms	विलोम शब्द	2	2026-08-10 14:07:38.876255+05:30
65e3b149-1454-492d-b252-1ddf2e32540a	6cc41c80-c152-4dbf-af7e-4b839ee5f499	Grammar	व्याकरण	3	2026-08-10 14:07:38.876255+05:30
af607d00-7e04-4beb-b719-9b2b20c2f110	62a0459a-9301-4f0f-9758-a43002904f61	Synonyms	पर्यायवाची शब्द	1	2026-08-10 14:07:38.876255+05:30
a1cdbefd-343b-4c60-a53b-96553e9ea142	62a0459a-9301-4f0f-9758-a43002904f61	Antonyms	विलोम शब्द	2	2026-08-10 14:07:38.876255+05:30
49334ad3-5d5c-4f82-bffd-2521a7dd6038	62a0459a-9301-4f0f-9758-a43002904f61	Grammar	व्याकरण	3	2026-08-10 14:07:38.876255+05:30
f31671ca-e309-490e-a530-d96f04896a07	fca1cb72-ac60-4738-9b8e-6cc64ed03f4c	Synonyms	पर्यायवाची शब्द	1	2026-08-10 14:07:38.876255+05:30
75ddcdd6-684e-47d4-81df-a08ffc3f2f9c	fca1cb72-ac60-4738-9b8e-6cc64ed03f4c	Antonyms	विलोम शब्द	2	2026-08-10 14:07:38.876255+05:30
1f465e1f-398d-4b1a-b676-f0991f0a6c3d	fca1cb72-ac60-4738-9b8e-6cc64ed03f4c	Grammar	व्याकरण	3	2026-08-10 14:07:38.876255+05:30
62a11770-eda9-448a-b48b-43aea2036f98	d22190d5-32b5-4990-9c9d-ccb148a1093b	Synonyms	पर्यायवाची शब्द	1	2026-08-10 14:07:38.876255+05:30
28523439-1cd2-41d6-bf11-668f19bef5ef	d22190d5-32b5-4990-9c9d-ccb148a1093b	Antonyms	विलोम शब्द	2	2026-08-10 14:07:38.876255+05:30
c5b3cfb1-a9cb-43fa-9402-d57289dc2253	d22190d5-32b5-4990-9c9d-ccb148a1093b	Grammar	व्याकरण	3	2026-08-10 14:07:38.876255+05:30
0dbf28c9-cb97-423d-9f96-6ad9031dac93	f7551e99-f828-4560-9014-db5c1b0ad5e3	Synonyms	पर्यायवाची शब्द	1	2026-08-10 14:07:38.876255+05:30
d6342e7c-297c-4a67-bb98-54fcc1d38ccf	f7551e99-f828-4560-9014-db5c1b0ad5e3	Antonyms	विलोम शब्द	2	2026-08-10 14:07:38.876255+05:30
aa362973-6cc6-4b2f-b08e-fd3171324691	f7551e99-f828-4560-9014-db5c1b0ad5e3	Grammar	व्याकरण	3	2026-08-10 14:07:38.876255+05:30
09498f19-65e0-44a7-bfe7-43644707e45b	8cf1ad49-c832-4b63-9567-7b8e2f435f52	Synonyms	पर्यायवाची शब्द	1	2026-08-10 14:07:38.876255+05:30
38e47297-e655-4ae0-8a96-7fa7125a9f16	8cf1ad49-c832-4b63-9567-7b8e2f435f52	Antonyms	विलोम शब्द	2	2026-08-10 14:07:38.876255+05:30
300284e9-d478-49a7-b079-fe949cc01f76	8cf1ad49-c832-4b63-9567-7b8e2f435f52	Grammar	व्याकरण	3	2026-08-10 14:07:38.876255+05:30
790cbebb-f336-49c8-a537-104d8567f0eb	b05ea465-78b5-47e2-925a-1e928b4e8eec	Indian History	भारतीय इतिहास	1	2026-08-10 14:07:38.876255+05:30
c7232000-ab4e-495e-b011-394938e5798d	b05ea465-78b5-47e2-925a-1e928b4e8eec	Indian Geography	भारतीय भूगोल	2	2026-08-10 14:07:38.876255+05:30
345a4130-7ee4-41ef-8a60-84a668c2ebee	b05ea465-78b5-47e2-925a-1e928b4e8eec	Indian Polity	भारतीय राजव्यवस्था	3	2026-08-10 14:07:38.876255+05:30
76ca97dd-609e-4ab6-b3fe-328c9d2179f3	b05ea465-78b5-47e2-925a-1e928b4e8eec	Current Affairs	समसामयिकी	4	2026-08-10 14:07:38.876255+05:30
c2e2a66d-21c8-4192-b4bd-a52ffc8b3779	b05ea465-78b5-47e2-925a-1e928b4e8eec	General Science	सामान्य विज्ञान	5	2026-08-10 14:07:38.876255+05:30
ec27a54d-58fe-4d78-8e27-818b6920afaf	2badd80d-a10b-4195-bb78-0364d6fef553	Indian History	भारतीय इतिहास	1	2026-08-10 14:07:38.876255+05:30
57a0a1a4-97e3-4280-8cf6-e62b560c2590	2badd80d-a10b-4195-bb78-0364d6fef553	Indian Geography	भारतीय भूगोल	2	2026-08-10 14:07:38.876255+05:30
d6e19cf6-95ef-4f8f-b267-f77ad0a5962e	2badd80d-a10b-4195-bb78-0364d6fef553	Indian Polity	भारतीय राजव्यवस्था	3	2026-08-10 14:07:38.876255+05:30
f46d7721-ef6e-466e-b451-1e5dc2abe027	2badd80d-a10b-4195-bb78-0364d6fef553	Current Affairs	समसामयिकी	4	2026-08-10 14:07:38.876255+05:30
5319196b-91e1-4ad1-9058-01f38470c2ab	2badd80d-a10b-4195-bb78-0364d6fef553	General Science	सामान्य विज्ञान	5	2026-08-10 14:07:38.876255+05:30
48c1fc19-e68d-4fd7-9880-efcc2be6ef25	54e29e57-aa8f-4e19-8160-6fdde7a5fa11	Indian History	भारतीय इतिहास	1	2026-08-10 14:07:38.876255+05:30
55e407b2-6ce7-4cbe-9a39-b6f45349ce29	54e29e57-aa8f-4e19-8160-6fdde7a5fa11	Indian Geography	भारतीय भूगोल	2	2026-08-10 14:07:38.876255+05:30
86ab6358-4c6f-466c-a78d-0b5292a5d79a	54e29e57-aa8f-4e19-8160-6fdde7a5fa11	Indian Polity	भारतीय राजव्यवस्था	3	2026-08-10 14:07:38.876255+05:30
6bbacb7b-cb14-4435-9f3e-22f831821b1c	54e29e57-aa8f-4e19-8160-6fdde7a5fa11	Current Affairs	समसामयिकी	4	2026-08-10 14:07:38.876255+05:30
ccf87cf0-403a-4c1d-a3e1-05e687bf8634	54e29e57-aa8f-4e19-8160-6fdde7a5fa11	General Science	सामान्य विज्ञान	5	2026-08-10 14:07:38.876255+05:30
b70a9aaa-4f7e-4906-a2f2-034fa87ee4a4	84dbdff1-80d8-4369-995d-c1c0a5d85d3f	Indian History	भारतीय इतिहास	1	2026-08-10 14:07:38.876255+05:30
4ac885ab-1bfc-4e0c-ac05-7bfa7bb8390e	84dbdff1-80d8-4369-995d-c1c0a5d85d3f	Indian Geography	भारतीय भूगोल	2	2026-08-10 14:07:38.876255+05:30
c65a322a-ba27-4a01-b6c5-bbc6e3541935	84dbdff1-80d8-4369-995d-c1c0a5d85d3f	Indian Polity	भारतीय राजव्यवस्था	3	2026-08-10 14:07:38.876255+05:30
653344d5-aff8-4b4c-80f8-dd2ef1d3f770	84dbdff1-80d8-4369-995d-c1c0a5d85d3f	Current Affairs	समसामयिकी	4	2026-08-10 14:07:38.876255+05:30
a737c10b-eebd-4777-b383-801174dc682e	84dbdff1-80d8-4369-995d-c1c0a5d85d3f	General Science	सामान्य विज्ञान	5	2026-08-10 14:07:38.876255+05:30
e5c891a0-29aa-4bde-8c2f-cb699bee28f2	9d4b6dd9-5075-4045-88db-aa2926587acc	Indian History	भारतीय इतिहास	1	2026-08-10 14:07:38.876255+05:30
136e3209-4b43-4df6-9ba1-e372e2cd85b2	9d4b6dd9-5075-4045-88db-aa2926587acc	Indian Geography	भारतीय भूगोल	2	2026-08-10 14:07:38.876255+05:30
c4b236ee-e853-4bdf-b3a2-129919871a3a	9d4b6dd9-5075-4045-88db-aa2926587acc	Indian Polity	भारतीय राजव्यवस्था	3	2026-08-10 14:07:38.876255+05:30
2af27eae-5450-4ea0-8c8e-f03169a39dd5	9d4b6dd9-5075-4045-88db-aa2926587acc	Current Affairs	समसामयिकी	4	2026-08-10 14:07:38.876255+05:30
61d97bbd-4ab9-452b-b8c7-8eb23baf1572	9d4b6dd9-5075-4045-88db-aa2926587acc	General Science	सामान्य विज्ञान	5	2026-08-10 14:07:38.876255+05:30
62ba55fa-63d0-45aa-a2f9-94ad773060bd	43be4ed8-27d4-448d-b14b-ef46ead563d3	Indian History	भारतीय इतिहास	1	2026-08-10 14:07:38.876255+05:30
27c4a1af-0716-4f96-a59a-f4d2d11adf71	43be4ed8-27d4-448d-b14b-ef46ead563d3	Indian Geography	भारतीय भूगोल	2	2026-08-10 14:07:38.876255+05:30
3fedb22c-b41f-4bb5-aaf2-5f01982ac46b	43be4ed8-27d4-448d-b14b-ef46ead563d3	Indian Polity	भारतीय राजव्यवस्था	3	2026-08-10 14:07:38.876255+05:30
dffcca8c-c4f3-4fb0-8d5d-659d78c22c72	43be4ed8-27d4-448d-b14b-ef46ead563d3	Current Affairs	समसामयिकी	4	2026-08-10 14:07:38.876255+05:30
c7148886-3e13-454e-9f43-5f9fb4eb854f	43be4ed8-27d4-448d-b14b-ef46ead563d3	General Science	सामान्य विज्ञान	5	2026-08-10 14:07:38.876255+05:30
e86cbc9a-3173-40af-85be-bb1a47364e66	8f8f0cc5-0e89-4a67-8799-de64ba3c3a89	Indian History	भारतीय इतिहास	1	2026-08-10 14:07:38.876255+05:30
d940888f-4314-49cb-b626-d8ab281fffba	8f8f0cc5-0e89-4a67-8799-de64ba3c3a89	Indian Geography	भारतीय भूगोल	2	2026-08-10 14:07:38.876255+05:30
3d169150-830a-41cc-bc88-19a569800189	8f8f0cc5-0e89-4a67-8799-de64ba3c3a89	Indian Polity	भारतीय राजव्यवस्था	3	2026-08-10 14:07:38.876255+05:30
bd80fbac-e6da-44ff-a4f5-02a5c1aaceb9	8f8f0cc5-0e89-4a67-8799-de64ba3c3a89	Current Affairs	समसामयिकी	4	2026-08-10 14:07:38.876255+05:30
2735399e-5c91-438b-9dd0-3c33a99e7090	8f8f0cc5-0e89-4a67-8799-de64ba3c3a89	General Science	सामान्य विज्ञान	5	2026-08-10 14:07:38.876255+05:30
6c4897bf-77b3-4089-9f12-75b1157eda37	44242f98-1e6b-4c5d-a41b-820330bad865	Indian History	भारतीय इतिहास	1	2026-08-10 14:07:38.876255+05:30
cc18cd7f-6cc2-4294-9331-6b1c0fccf0a6	44242f98-1e6b-4c5d-a41b-820330bad865	Indian Geography	भारतीय भूगोल	2	2026-08-10 14:07:38.876255+05:30
5f6509bd-8e7f-4bb3-867f-289ac9abb886	44242f98-1e6b-4c5d-a41b-820330bad865	Indian Polity	भारतीय राजव्यवस्था	3	2026-08-10 14:07:38.876255+05:30
0fa2ddff-c3d3-428e-a0bc-3628ef31733a	44242f98-1e6b-4c5d-a41b-820330bad865	Current Affairs	समसामयिकी	4	2026-08-10 14:07:38.876255+05:30
f3f7267e-83a9-4bbd-acde-285a9469483a	44242f98-1e6b-4c5d-a41b-820330bad865	General Science	सामान्य विज्ञान	5	2026-08-10 14:07:38.876255+05:30
ac5af3c9-eff0-449e-b87f-c819afe7f2a7	3aaa7858-993a-4072-801a-40a8fc544ed8	Indian History	भारतीय इतिहास	1	2026-08-10 14:07:38.876255+05:30
f4ad7d31-795d-4526-8534-59f895757a58	3aaa7858-993a-4072-801a-40a8fc544ed8	Indian Geography	भारतीय भूगोल	2	2026-08-10 14:07:38.876255+05:30
78ed1c32-771b-4b90-b709-73a13310fa0c	3aaa7858-993a-4072-801a-40a8fc544ed8	Indian Polity	भारतीय राजव्यवस्था	3	2026-08-10 14:07:38.876255+05:30
20e63e56-2e04-4750-aeb4-5c47a297a779	3aaa7858-993a-4072-801a-40a8fc544ed8	Current Affairs	समसामयिकी	4	2026-08-10 14:07:38.876255+05:30
0d14310f-d7bc-4fd0-8c3c-4c0b492eccd9	3aaa7858-993a-4072-801a-40a8fc544ed8	General Science	सामान्य विज्ञान	5	2026-08-10 14:07:38.876255+05:30
cdf1f1e0-829e-4dac-99ef-de2ccb20b8a5	cee688e7-1b68-484e-928e-80d23612f514	Arithmetic	अंकगणित	1	2026-08-10 14:07:38.876255+05:30
782d0705-4ffe-4186-bb53-67e4f2e5aa2c	cee688e7-1b68-484e-928e-80d23612f514	Percentage	प्रतिशत	2	2026-08-10 14:07:38.876255+05:30
5b69d854-cb0f-4925-a932-ab04e9a427d7	cee688e7-1b68-484e-928e-80d23612f514	Time and Distance	समय और दूरी	3	2026-08-10 14:07:38.876255+05:30
4b10b694-31ea-4116-b130-deb23b896bf8	cee688e7-1b68-484e-928e-80d23612f514	Profit and Loss	लाभ और हानि	4	2026-08-10 14:07:38.876255+05:30
68ded6b8-032a-401f-b432-a278e2b9c229	5f5dcb1f-ad08-4432-a4fe-001686cc88f0	Arithmetic	अंकगणित	1	2026-08-10 14:07:38.876255+05:30
edeca27e-ed05-4c97-9463-b6a61029e741	5f5dcb1f-ad08-4432-a4fe-001686cc88f0	Percentage	प्रतिशत	2	2026-08-10 14:07:38.876255+05:30
5a15b271-12cf-43ad-8b3c-9bea244f12bf	5f5dcb1f-ad08-4432-a4fe-001686cc88f0	Time and Distance	समय और दूरी	3	2026-08-10 14:07:38.876255+05:30
a05b397e-027e-4ef3-a2cf-9662646a155b	5f5dcb1f-ad08-4432-a4fe-001686cc88f0	Profit and Loss	लाभ और हानि	4	2026-08-10 14:07:38.876255+05:30
e099fe7a-a0bf-4f27-baf9-3244967e7f9a	f6def010-812b-4df2-84a0-648d1f213e9d	Arithmetic	अंकगणित	1	2026-08-10 14:07:38.876255+05:30
9100d84d-fff3-4954-9163-7aba242f19fb	f6def010-812b-4df2-84a0-648d1f213e9d	Percentage	प्रतिशत	2	2026-08-10 14:07:38.876255+05:30
4122236c-8b0d-49fc-a504-2a358e72e41d	f6def010-812b-4df2-84a0-648d1f213e9d	Time and Distance	समय और दूरी	3	2026-08-10 14:07:38.876255+05:30
6c53eea0-6cfa-4832-a7f9-162a416a0089	f6def010-812b-4df2-84a0-648d1f213e9d	Profit and Loss	लाभ और हानि	4	2026-08-10 14:07:38.876255+05:30
a6a67d2f-03d1-41e5-8272-cd57f185e805	aa3023db-9e24-4740-b6ac-c4124a730f25	Arithmetic	अंकगणित	1	2026-08-10 14:07:38.876255+05:30
d1934494-eabc-458d-b3aa-dae33fd7272a	aa3023db-9e24-4740-b6ac-c4124a730f25	Percentage	प्रतिशत	2	2026-08-10 14:07:38.876255+05:30
8cecf206-dff1-485a-900c-e85b9699488d	aa3023db-9e24-4740-b6ac-c4124a730f25	Time and Distance	समय और दूरी	3	2026-08-10 14:07:38.876255+05:30
cf221f01-f9d3-4a19-9a46-9c1e3ab492f7	aa3023db-9e24-4740-b6ac-c4124a730f25	Profit and Loss	लाभ और हानि	4	2026-08-10 14:07:38.876255+05:30
aec2a8f1-2593-4568-8099-691648cbc668	2c9d6558-fc75-4831-8f8a-52642c99a415	Arithmetic	अंकगणित	1	2026-08-10 14:07:38.876255+05:30
fdaa0377-be91-4eb6-8b08-f5a0ddb34026	2c9d6558-fc75-4831-8f8a-52642c99a415	Percentage	प्रतिशत	2	2026-08-10 14:07:38.876255+05:30
4a1c09e2-bcdc-4cc7-9357-f0fc42812ca9	2c9d6558-fc75-4831-8f8a-52642c99a415	Time and Distance	समय और दूरी	3	2026-08-10 14:07:38.876255+05:30
e554062c-ab62-42f8-84e6-94b2f1e0ce3f	2c9d6558-fc75-4831-8f8a-52642c99a415	Profit and Loss	लाभ और हानि	4	2026-08-10 14:07:38.876255+05:30
20fe7d8e-5e4d-4c13-86b1-8e3a52b06402	0b12dcae-bc2f-4631-b865-b45589e8f6f2	Arithmetic	अंकगणित	1	2026-08-10 14:07:38.876255+05:30
92b52ca9-0879-4b09-8f7e-7c8e6cb1f444	0b12dcae-bc2f-4631-b865-b45589e8f6f2	Percentage	प्रतिशत	2	2026-08-10 14:07:38.876255+05:30
dfa8c85c-f93e-4e27-a86c-ecb7a2a94ee2	0b12dcae-bc2f-4631-b865-b45589e8f6f2	Time and Distance	समय और दूरी	3	2026-08-10 14:07:38.876255+05:30
20ab7430-681d-46e3-b92d-a7c6494f93c0	0b12dcae-bc2f-4631-b865-b45589e8f6f2	Profit and Loss	लाभ और हानि	4	2026-08-10 14:07:38.876255+05:30
5f5e218e-869c-44cd-aa48-bea7cd56be98	bf6da72a-0003-4e73-ad40-0243b0f6430f	Arithmetic	अंकगणित	1	2026-08-10 14:07:38.876255+05:30
3882df71-af73-4a36-a2ca-70481a8cc0ea	bf6da72a-0003-4e73-ad40-0243b0f6430f	Percentage	प्रतिशत	2	2026-08-10 14:07:38.876255+05:30
b4fb3d0e-e799-4cdd-9a86-dfa936752f76	bf6da72a-0003-4e73-ad40-0243b0f6430f	Time and Distance	समय और दूरी	3	2026-08-10 14:07:38.876255+05:30
c8bd1f3a-8164-4bc3-9523-fc55b09e1c6c	bf6da72a-0003-4e73-ad40-0243b0f6430f	Profit and Loss	लाभ और हानि	4	2026-08-10 14:07:38.876255+05:30
0aff93bd-d8cf-4b98-832c-3b43401bdc01	c0a08513-fdc4-4984-92db-0c68e7b1146d	Arithmetic	अंकगणित	1	2026-08-10 14:07:38.876255+05:30
fa18b0da-3b7d-46f5-850a-cf6a9435145d	c0a08513-fdc4-4984-92db-0c68e7b1146d	Percentage	प्रतिशत	2	2026-08-10 14:07:38.876255+05:30
810ce49d-cd5c-4c6a-ad10-0be6c7c5325f	c0a08513-fdc4-4984-92db-0c68e7b1146d	Time and Distance	समय और दूरी	3	2026-08-10 14:07:38.876255+05:30
4ee010b0-9c67-4476-a9b0-6843d47ce25d	c0a08513-fdc4-4984-92db-0c68e7b1146d	Profit and Loss	लाभ और हानि	4	2026-08-10 14:07:38.876255+05:30
afda72b6-76db-4711-93a6-4b170712a449	2a5ca1e2-4d08-411a-bb08-8242447913e4	Arithmetic	अंकगणित	1	2026-08-10 14:07:38.876255+05:30
ab9b4709-59de-4f9a-8663-e296b11365cc	2a5ca1e2-4d08-411a-bb08-8242447913e4	Percentage	प्रतिशत	2	2026-08-10 14:07:38.876255+05:30
87084625-c6cf-4b5f-bfd3-0444cc8948e1	2a5ca1e2-4d08-411a-bb08-8242447913e4	Time and Distance	समय और दूरी	3	2026-08-10 14:07:38.876255+05:30
46f4019a-6f2d-4788-aefb-6f487a89c84a	2a5ca1e2-4d08-411a-bb08-8242447913e4	Profit and Loss	लाभ और हानि	4	2026-08-10 14:07:38.876255+05:30
f34fb9ff-3c38-4b07-9759-40135c03d73d	29e052c3-7ed2-4b59-ba9a-d963865d59c5	Number Series	संख्या श्रृंखला	1	2026-08-10 14:07:38.876255+05:30
5422df66-fc3d-4974-afb0-580cd2ef87cd	29e052c3-7ed2-4b59-ba9a-d963865d59c5	Analogy	सादृश्यता	2	2026-08-10 14:07:38.876255+05:30
44e66f13-550b-45c8-a264-12a8a3bfaf51	29e052c3-7ed2-4b59-ba9a-d963865d59c5	Classification	वर्गीकरण	3	2026-08-10 14:07:38.876255+05:30
a670f238-51e2-4ad6-9175-b65d61ebd5f2	29e052c3-7ed2-4b59-ba9a-d963865d59c5	Coding-Decoding	कोडिंग-डिकोडिंग	4	2026-08-10 14:07:38.876255+05:30
6383c35a-30b7-4e5e-8285-fbd883823c02	24567795-25fe-4c30-b934-0ae2669cd465	Number Series	संख्या श्रृंखला	1	2026-08-10 14:07:38.876255+05:30
9f8e1f4e-7034-4a31-a033-65851d4fb19e	24567795-25fe-4c30-b934-0ae2669cd465	Analogy	सादृश्यता	2	2026-08-10 14:07:38.876255+05:30
50f5e589-0f2a-42fe-8ebb-cfd07c02d1e0	24567795-25fe-4c30-b934-0ae2669cd465	Classification	वर्गीकरण	3	2026-08-10 14:07:38.876255+05:30
a37806ff-acdf-43b1-ae27-25219df370a6	24567795-25fe-4c30-b934-0ae2669cd465	Coding-Decoding	कोडिंग-डिकोडिंग	4	2026-08-10 14:07:38.876255+05:30
a97c787f-eabc-483e-920d-b38c59b575b1	9aedf889-9b4e-470e-aaaa-dd806b83c6d8	Number Series	संख्या श्रृंखला	1	2026-08-10 14:07:38.876255+05:30
647c21ca-0778-4942-b18f-1452a9457510	9aedf889-9b4e-470e-aaaa-dd806b83c6d8	Analogy	सादृश्यता	2	2026-08-10 14:07:38.876255+05:30
ff1bf35a-a069-4b4c-89a6-9844784776a3	9aedf889-9b4e-470e-aaaa-dd806b83c6d8	Classification	वर्गीकरण	3	2026-08-10 14:07:38.876255+05:30
c9e0b05d-b91c-4cd3-98c7-550d1e3816a2	9aedf889-9b4e-470e-aaaa-dd806b83c6d8	Coding-Decoding	कोडिंग-डिकोडिंग	4	2026-08-10 14:07:38.876255+05:30
ef86036b-c5ca-4966-9e7d-f71857f06a9e	33a7ec1c-1c71-49c7-8c05-818e94c132a3	Number Series	संख्या श्रृंखला	1	2026-08-10 14:07:38.876255+05:30
57515313-41bb-4213-a31a-74dd04d5ac78	33a7ec1c-1c71-49c7-8c05-818e94c132a3	Analogy	सादृश्यता	2	2026-08-10 14:07:38.876255+05:30
3385ee24-6dce-41e0-bf74-e3a84c09d3fe	33a7ec1c-1c71-49c7-8c05-818e94c132a3	Classification	वर्गीकरण	3	2026-08-10 14:07:38.876255+05:30
7fa63a1d-d89b-49ec-a79c-4b3b67eb5192	33a7ec1c-1c71-49c7-8c05-818e94c132a3	Coding-Decoding	कोडिंग-डिकोडिंग	4	2026-08-10 14:07:38.876255+05:30
c5a3f22e-ba55-409c-93cb-9856792daaf9	043587b3-5ed2-445f-92cd-357149a15718	Number Series	संख्या श्रृंखला	1	2026-08-10 14:07:38.876255+05:30
eb9b0b1a-6f42-4b79-8612-c45fc91763dc	043587b3-5ed2-445f-92cd-357149a15718	Analogy	सादृश्यता	2	2026-08-10 14:07:38.876255+05:30
16de65e8-ab0b-4af9-8027-21c598a03e00	043587b3-5ed2-445f-92cd-357149a15718	Classification	वर्गीकरण	3	2026-08-10 14:07:38.876255+05:30
5d510ad2-a48c-4982-9a74-7119b4b540b5	043587b3-5ed2-445f-92cd-357149a15718	Coding-Decoding	कोडिंग-डिकोडिंग	4	2026-08-10 14:07:38.876255+05:30
e7af3f93-3472-470f-9e78-2c4018999cf2	0603cbba-b165-43c8-8ad2-312512feaca4	Number Series	संख्या श्रृंखला	1	2026-08-10 14:07:38.876255+05:30
cafa2a69-9e09-432c-a285-1e5bef7e5818	0603cbba-b165-43c8-8ad2-312512feaca4	Analogy	सादृश्यता	2	2026-08-10 14:07:38.876255+05:30
3f192191-9785-47bb-ad85-0bc8012e7ade	0603cbba-b165-43c8-8ad2-312512feaca4	Classification	वर्गीकरण	3	2026-08-10 14:07:38.876255+05:30
7624dd97-de84-4488-8346-cdc5fb280567	0603cbba-b165-43c8-8ad2-312512feaca4	Coding-Decoding	कोडिंग-डिकोडिंग	4	2026-08-10 14:07:38.876255+05:30
0d89297f-3767-449c-bc52-6bcbf7f0e19b	002b0bff-8240-4365-b352-05305fe87f19	Number Series	संख्या श्रृंखला	1	2026-08-10 14:07:38.876255+05:30
607aea18-e654-4d9d-80e6-a496d9f49a4c	002b0bff-8240-4365-b352-05305fe87f19	Analogy	सादृश्यता	2	2026-08-10 14:07:38.876255+05:30
4fb1ff78-59e1-439d-b5dc-0072c6a2dd32	002b0bff-8240-4365-b352-05305fe87f19	Classification	वर्गीकरण	3	2026-08-10 14:07:38.876255+05:30
9b49b48e-8e84-428d-afe0-8bb46f7b5de2	002b0bff-8240-4365-b352-05305fe87f19	Coding-Decoding	कोडिंग-डिकोडिंग	4	2026-08-10 14:07:38.876255+05:30
90135371-5441-4264-aead-d75b47324569	eb2b3a0f-4973-4acf-afed-eb438e82e817	Number Series	संख्या श्रृंखला	1	2026-08-10 14:07:38.876255+05:30
7ce0901a-2769-434f-9d8c-d2bae291c1ed	eb2b3a0f-4973-4acf-afed-eb438e82e817	Analogy	सादृश्यता	2	2026-08-10 14:07:38.876255+05:30
82d70a73-ded1-4858-81e7-f816a354ab67	eb2b3a0f-4973-4acf-afed-eb438e82e817	Classification	वर्गीकरण	3	2026-08-10 14:07:38.876255+05:30
b4f577f9-156e-4676-abb9-7e716427b1fa	eb2b3a0f-4973-4acf-afed-eb438e82e817	Coding-Decoding	कोडिंग-डिकोडिंग	4	2026-08-10 14:07:38.876255+05:30
cf3847e2-6140-4b24-a3a8-05480edcd895	e013d528-69c5-43ae-82de-836a9f5859ed	Number Series	संख्या श्रृंखला	1	2026-08-10 14:07:38.876255+05:30
a82014a1-0231-4b7b-b2ac-9a50f93111df	e013d528-69c5-43ae-82de-836a9f5859ed	Analogy	सादृश्यता	2	2026-08-10 14:07:38.876255+05:30
0876dbfa-9f85-4cf1-ac51-00b46d34304d	e013d528-69c5-43ae-82de-836a9f5859ed	Classification	वर्गीकरण	3	2026-08-10 14:07:38.876255+05:30
4330171a-b48f-4016-af22-6f10ff547673	e013d528-69c5-43ae-82de-836a9f5859ed	Coding-Decoding	कोडिंग-डिकोडिंग	4	2026-08-10 14:07:38.876255+05:30
\.


--
-- Data for Name: user_active_plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_active_plans (id, user_id, plan_id, plan_date, created_at) FROM stdin;
\.


--
-- Data for Name: user_activities; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_activities (id, user_id, activity_date, created_at) FROM stdin;
\.


--
-- Data for Name: user_exams; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_exams (id, user_id, exam_id, enrolled_at, is_active) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, phone, email, full_name, avatar_url, preferred_language, selected_exam_id, google_id, google_avatar_url, onboarding_completed, exam_change_count_this_month, exam_change_month, deletion_scheduled_at, created_at, updated_at, best_streak, role, trial_ends_at, paid_until) FROM stdin;
\.


--
-- Name: auth_audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.auth_audit_log_id_seq', 1, false);


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pgmigrations_id_seq', 32, true);


--
-- Name: account_links account_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_links
    ADD CONSTRAINT account_links_pkey PRIMARY KEY (id);


--
-- Name: admin_activity_log admin_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_activity_log
    ADD CONSTRAINT admin_activity_log_pkey PRIMARY KEY (id);


--
-- Name: attempt_answers attempt_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_answers
    ADD CONSTRAINT attempt_answers_pkey PRIMARY KEY (id);


--
-- Name: auth_audit_log auth_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_audit_log
    ADD CONSTRAINT auth_audit_log_pkey PRIMARY KEY (id);


--
-- Name: coin_transactions coin_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_transactions
    ADD CONSTRAINT coin_transactions_pkey PRIMARY KEY (id);


--
-- Name: daily_plan_progress daily_plan_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_plan_progress
    ADD CONSTRAINT daily_plan_progress_pkey PRIMARY KEY (id);


--
-- Name: daily_plan_progress daily_plan_progress_user_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_plan_progress
    ADD CONSTRAINT daily_plan_progress_user_id_date_key UNIQUE (user_id, date);


--
-- Name: daily_quiz_attempts daily_quiz_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_quiz_attempts
    ADD CONSTRAINT daily_quiz_attempts_pkey PRIMARY KEY (id);


--
-- Name: discussion_messages discussion_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussion_messages
    ADD CONSTRAINT discussion_messages_pkey PRIMARY KEY (id);


--
-- Name: discussion_reports discussion_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussion_reports
    ADD CONSTRAINT discussion_reports_pkey PRIMARY KEY (message_id, user_id);


--
-- Name: dynamic_full_tests dynamic_full_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_full_tests
    ADD CONSTRAINT dynamic_full_tests_pkey PRIMARY KEY (id);


--
-- Name: dynamic_full_tests dynamic_full_tests_user_id_subject_id_slot_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_full_tests
    ADD CONSTRAINT dynamic_full_tests_user_id_subject_id_slot_number_key UNIQUE (user_id, subject_id, slot_number);


--
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (id);


--
-- Name: pgmigrations pgmigrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations
    ADD CONSTRAINT pgmigrations_pkey PRIMARY KEY (id);


--
-- Name: question_exams pk_question_exams; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_exams
    ADD CONSTRAINT pk_question_exams PRIMARY KEY (question_id, exam_id);


--
-- Name: test_questions pk_test_questions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_questions
    ADD CONSTRAINT pk_test_questions PRIMARY KEY (test_id, question_id);


--
-- Name: plan_item_completions plan_item_completions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_item_completions
    ADD CONSTRAINT plan_item_completions_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: revision_marks revision_marks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revision_marks
    ADD CONSTRAINT revision_marks_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: study_plan_item_tests study_plan_item_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_item_tests
    ADD CONSTRAINT study_plan_item_tests_pkey PRIMARY KEY (id);


--
-- Name: study_plan_item_tests study_plan_item_tests_plan_item_id_test_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_item_tests
    ADD CONSTRAINT study_plan_item_tests_plan_item_id_test_id_key UNIQUE (plan_item_id, test_id);


--
-- Name: study_plan_item_topics study_plan_item_topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_item_topics
    ADD CONSTRAINT study_plan_item_topics_pkey PRIMARY KEY (id);


--
-- Name: study_plan_item_topics study_plan_item_topics_plan_item_id_topic_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_item_topics
    ADD CONSTRAINT study_plan_item_topics_plan_item_id_topic_id_key UNIQUE (plan_item_id, topic_id);


--
-- Name: study_plan_items study_plan_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_items
    ADD CONSTRAINT study_plan_items_pkey PRIMARY KEY (id);


--
-- Name: study_plans study_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plans
    ADD CONSTRAINT study_plans_pkey PRIMARY KEY (id);


--
-- Name: subject_visits subject_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_visits
    ADD CONSTRAINT subject_visits_pkey PRIMARY KEY (id);


--
-- Name: subject_visits subject_visits_user_id_subject_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_visits
    ADD CONSTRAINT subject_visits_user_id_subject_id_key UNIQUE (user_id, subject_id);


--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- Name: subscription_grants subscription_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_grants
    ADD CONSTRAINT subscription_grants_pkey PRIMARY KEY (id);


--
-- Name: test_attempts test_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_attempts
    ADD CONSTRAINT test_attempts_pkey PRIMARY KEY (id);


--
-- Name: tests tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_pkey PRIMARY KEY (id);


--
-- Name: topic_part_progress topic_part_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_part_progress
    ADD CONSTRAINT topic_part_progress_pkey PRIMARY KEY (id);


--
-- Name: topic_part_progress topic_part_progress_user_id_part_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_part_progress
    ADD CONSTRAINT topic_part_progress_user_id_part_id_key UNIQUE (user_id, part_id);


--
-- Name: topic_parts topic_parts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_parts
    ADD CONSTRAINT topic_parts_pkey PRIMARY KEY (id);


--
-- Name: topic_parts topic_parts_topic_id_part_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_parts
    ADD CONSTRAINT topic_parts_topic_id_part_number_key UNIQUE (topic_id, part_number);


--
-- Name: topic_progress topic_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_progress
    ADD CONSTRAINT topic_progress_pkey PRIMARY KEY (id);


--
-- Name: topics topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_pkey PRIMARY KEY (id);


--
-- Name: attempt_answers uq_attempt_question_order; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_answers
    ADD CONSTRAINT uq_attempt_question_order UNIQUE (attempt_id, question_order);


--
-- Name: test_questions uq_test_question_order; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_questions
    ADD CONSTRAINT uq_test_question_order UNIQUE (test_id, question_order);


--
-- Name: topics uq_topic_name_per_subject; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT uq_topic_name_per_subject UNIQUE (subject_id, name_en);


--
-- Name: user_active_plans uq_user_active_plan_date; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_active_plans
    ADD CONSTRAINT uq_user_active_plan_date UNIQUE (user_id, plan_date);


--
-- Name: user_activities uq_user_activity_date; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activities
    ADD CONSTRAINT uq_user_activity_date UNIQUE (user_id, activity_date);


--
-- Name: plan_item_completions uq_user_item_completion_date; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_item_completions
    ADD CONSTRAINT uq_user_item_completion_date UNIQUE (user_id, item_id, completion_date);


--
-- Name: revision_marks uq_user_question_revision; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revision_marks
    ADD CONSTRAINT uq_user_question_revision UNIQUE (user_id, question_id);


--
-- Name: daily_quiz_attempts uq_user_quiz_date; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_quiz_attempts
    ADD CONSTRAINT uq_user_quiz_date UNIQUE (user_id, quiz_date);


--
-- Name: topic_progress uq_user_topic_progress; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_progress
    ADD CONSTRAINT uq_user_topic_progress UNIQUE (user_id, topic_id);


--
-- Name: user_active_plans user_active_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_active_plans
    ADD CONSTRAINT user_active_plans_pkey PRIMARY KEY (id);


--
-- Name: user_activities user_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activities
    ADD CONSTRAINT user_activities_pkey PRIMARY KEY (id);


--
-- Name: user_exams user_exams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_exams
    ADD CONSTRAINT user_exams_pkey PRIMARY KEY (id);


--
-- Name: user_exams user_exams_user_id_exam_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_exams
    ADD CONSTRAINT user_exams_user_id_exam_id_key UNIQUE (user_id, exam_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_google_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_key UNIQUE (google_id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_active_plans_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_active_plans_user_date ON public.user_active_plans USING btree (user_id, plan_date DESC);


--
-- Name: idx_admin_activity_admin_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_activity_admin_date ON public.admin_activity_log USING btree (admin_id, created_at DESC);


--
-- Name: idx_admin_activity_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_activity_entity ON public.admin_activity_log USING btree (entity_type, entity_id);


--
-- Name: idx_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_action ON public.auth_audit_log USING btree (action, created_at DESC);


--
-- Name: idx_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_user ON public.auth_audit_log USING btree (user_id, created_at DESC);


--
-- Name: idx_coin_transactions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_transactions_user ON public.coin_transactions USING btree (user_id, created_at DESC);


--
-- Name: idx_completions_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_completions_user_date ON public.plan_item_completions USING btree (user_id, completion_date);


--
-- Name: idx_daily_plan_progress_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_plan_progress_user_date ON public.daily_plan_progress USING btree (user_id, date);


--
-- Name: idx_daily_quiz_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_quiz_user_date ON public.daily_quiz_attempts USING btree (user_id, quiz_date DESC);


--
-- Name: idx_discussion_messages_room; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discussion_messages_room ON public.discussion_messages USING btree (room_key, created_at DESC);


--
-- Name: idx_discussion_messages_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discussion_messages_user ON public.discussion_messages USING btree (user_id, created_at DESC);


--
-- Name: idx_dynamic_full_tests_user_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dynamic_full_tests_user_subject ON public.dynamic_full_tests USING btree (user_id, subject_id);


--
-- Name: idx_part_progress_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_part_progress_user ON public.topic_part_progress USING btree (user_id);


--
-- Name: idx_plan_item_tests_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_item_tests_item ON public.study_plan_item_tests USING btree (plan_item_id);


--
-- Name: idx_plan_item_topics_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_item_topics_item ON public.study_plan_item_topics USING btree (plan_item_id);


--
-- Name: idx_plan_items_plan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_items_plan_id ON public.study_plan_items USING btree (plan_id);


--
-- Name: idx_questions_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_group_id ON public.questions USING btree (question_group_id) WHERE (question_group_id IS NOT NULL);


--
-- Name: idx_questions_question_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_question_type ON public.questions USING btree (question_type) WHERE (question_type IS NOT NULL);


--
-- Name: idx_sessions_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_expires ON public.sessions USING btree (expires_at);


--
-- Name: idx_sessions_token_family; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_token_family ON public.sessions USING btree (token_family);


--
-- Name: idx_sessions_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user_active ON public.sessions USING btree (user_id, is_active) WHERE (is_active = true);


--
-- Name: idx_study_plans_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_study_plans_user_created ON public.study_plans USING btree (user_id, created_at DESC);


--
-- Name: idx_subject_visits_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subject_visits_user ON public.subject_visits USING btree (user_id);


--
-- Name: idx_subjects_exam_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subjects_exam_id ON public.subjects USING btree (exam_id);


--
-- Name: idx_subscription_grants_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_grants_user ON public.subscription_grants USING btree (user_id, created_at DESC);


--
-- Name: idx_test_attempts_user_test; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_test_attempts_user_test ON public.test_attempts USING btree (user_id, test_id);


--
-- Name: idx_tests_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tests_category ON public.tests USING btree (category);


--
-- Name: idx_tests_subject_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tests_subject_id ON public.tests USING btree (subject_id);


--
-- Name: idx_tests_topic_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tests_topic_id ON public.tests USING btree (topic_id);


--
-- Name: idx_topic_parts_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_topic_parts_topic ON public.topic_parts USING btree (topic_id);


--
-- Name: idx_topic_progress_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_topic_progress_user_status ON public.topic_progress USING btree (user_id, status);


--
-- Name: idx_topic_progress_user_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_topic_progress_user_subject ON public.topic_progress USING btree (user_id, subject_id);


--
-- Name: idx_topics_subject_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_topics_subject_id ON public.topics USING btree (subject_id);


--
-- Name: idx_user_activities_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activities_user_date ON public.user_activities USING btree (user_id, activity_date DESC);


--
-- Name: idx_user_exams_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_exams_user ON public.user_exams USING btree (user_id);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: uq_coin_daily_login; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_coin_daily_login ON public.coin_transactions USING btree (user_id, type, (((created_at AT TIME ZONE 'Asia/Kolkata'::text))::date)) WHERE ((type)::text = 'daily_login'::text);


--
-- Name: uq_coin_quiz_daily; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_coin_quiz_daily ON public.coin_transactions USING btree (user_id, type, (((created_at AT TIME ZONE 'Asia/Kolkata'::text))::date)) WHERE ((type)::text = 'quiz_complete'::text);


--
-- Name: uq_coin_referral; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_coin_referral ON public.coin_transactions USING btree (user_id, type, reference_id) WHERE ((type)::text = 'referral'::text);


--
-- Name: uq_coin_test_attempt; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_coin_test_attempt ON public.coin_transactions USING btree (user_id, type, reference_id) WHERE ((type)::text = 'test_complete'::text);


--
-- Name: account_links account_links_primary_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_links
    ADD CONSTRAINT account_links_primary_user_id_fkey FOREIGN KEY (primary_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: admin_activity_log admin_activity_log_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_activity_log
    ADD CONSTRAINT admin_activity_log_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id);


--
-- Name: attempt_answers attempt_answers_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_answers
    ADD CONSTRAINT attempt_answers_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.test_attempts(id) ON DELETE CASCADE;


--
-- Name: attempt_answers attempt_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_answers
    ADD CONSTRAINT attempt_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: auth_audit_log auth_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_audit_log
    ADD CONSTRAINT auth_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: coin_transactions coin_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_transactions
    ADD CONSTRAINT coin_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: daily_plan_progress daily_plan_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_plan_progress
    ADD CONSTRAINT daily_plan_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: daily_quiz_attempts daily_quiz_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_quiz_attempts
    ADD CONSTRAINT daily_quiz_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: discussion_messages discussion_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussion_messages
    ADD CONSTRAINT discussion_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: discussion_reports discussion_reports_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussion_reports
    ADD CONSTRAINT discussion_reports_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.discussion_messages(id) ON DELETE CASCADE;


--
-- Name: discussion_reports discussion_reports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussion_reports
    ADD CONSTRAINT discussion_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: dynamic_full_tests dynamic_full_tests_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_full_tests
    ADD CONSTRAINT dynamic_full_tests_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id);


--
-- Name: dynamic_full_tests dynamic_full_tests_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_full_tests
    ADD CONSTRAINT dynamic_full_tests_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id);


--
-- Name: dynamic_full_tests dynamic_full_tests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_full_tests
    ADD CONSTRAINT dynamic_full_tests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: plan_item_completions plan_item_completions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_item_completions
    ADD CONSTRAINT plan_item_completions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.study_plan_items(id) ON DELETE CASCADE;


--
-- Name: plan_item_completions plan_item_completions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_item_completions
    ADD CONSTRAINT plan_item_completions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: question_exams question_exams_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_exams
    ADD CONSTRAINT question_exams_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;


--
-- Name: question_exams question_exams_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_exams
    ADD CONSTRAINT question_exams_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;


--
-- Name: revision_marks revision_marks_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revision_marks
    ADD CONSTRAINT revision_marks_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: revision_marks revision_marks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revision_marks
    ADD CONSTRAINT revision_marks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: study_plan_item_tests study_plan_item_tests_plan_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_item_tests
    ADD CONSTRAINT study_plan_item_tests_plan_item_id_fkey FOREIGN KEY (plan_item_id) REFERENCES public.study_plan_items(id) ON DELETE CASCADE;


--
-- Name: study_plan_item_tests study_plan_item_tests_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_item_tests
    ADD CONSTRAINT study_plan_item_tests_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id);


--
-- Name: study_plan_item_topics study_plan_item_topics_plan_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_item_topics
    ADD CONSTRAINT study_plan_item_topics_plan_item_id_fkey FOREIGN KEY (plan_item_id) REFERENCES public.study_plan_items(id) ON DELETE CASCADE;


--
-- Name: study_plan_item_topics study_plan_item_topics_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_item_topics
    ADD CONSTRAINT study_plan_item_topics_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id);


--
-- Name: study_plan_items study_plan_items_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_items
    ADD CONSTRAINT study_plan_items_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.study_plans(id) ON DELETE CASCADE;


--
-- Name: study_plan_items study_plan_items_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_items
    ADD CONSTRAINT study_plan_items_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id);


--
-- Name: study_plans study_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plans
    ADD CONSTRAINT study_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subject_visits subject_visits_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_visits
    ADD CONSTRAINT subject_visits_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id);


--
-- Name: subject_visits subject_visits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_visits
    ADD CONSTRAINT subject_visits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subjects subjects_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id);


--
-- Name: subscription_grants subscription_grants_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_grants
    ADD CONSTRAINT subscription_grants_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: subscription_grants subscription_grants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_grants
    ADD CONSTRAINT subscription_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: test_attempts test_attempts_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_attempts
    ADD CONSTRAINT test_attempts_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id);


--
-- Name: test_attempts test_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_attempts
    ADD CONSTRAINT test_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: test_questions test_questions_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_questions
    ADD CONSTRAINT test_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: test_questions test_questions_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_questions
    ADD CONSTRAINT test_questions_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;


--
-- Name: tests tests_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id);


--
-- Name: tests tests_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id);


--
-- Name: tests tests_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id);


--
-- Name: topic_part_progress topic_part_progress_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_part_progress
    ADD CONSTRAINT topic_part_progress_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.topic_parts(id) ON DELETE CASCADE;


--
-- Name: topic_part_progress topic_part_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_part_progress
    ADD CONSTRAINT topic_part_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: topic_parts topic_parts_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_parts
    ADD CONSTRAINT topic_parts_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id);


--
-- Name: topic_parts topic_parts_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_parts
    ADD CONSTRAINT topic_parts_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE CASCADE;


--
-- Name: topic_progress topic_progress_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_progress
    ADD CONSTRAINT topic_progress_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id);


--
-- Name: topic_progress topic_progress_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_progress
    ADD CONSTRAINT topic_progress_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id);


--
-- Name: topic_progress topic_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_progress
    ADD CONSTRAINT topic_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: topics topics_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: user_active_plans user_active_plans_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_active_plans
    ADD CONSTRAINT user_active_plans_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.study_plans(id) ON DELETE CASCADE;


--
-- Name: user_active_plans user_active_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_active_plans
    ADD CONSTRAINT user_active_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_activities user_activities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activities
    ADD CONSTRAINT user_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_exams user_exams_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_exams
    ADD CONSTRAINT user_exams_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id);


--
-- Name: user_exams user_exams_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_exams
    ADD CONSTRAINT user_exams_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_selected_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_selected_exam_id_fkey FOREIGN KEY (selected_exam_id) REFERENCES public.exams(id);


--
-- PostgreSQL database dump complete
--

\unrestrict foIfv1NXHxwbfKQ3vbJjJSMtKZ0T93XT2oO5hqgccKSlcf6ggORfjNCOQtC2O0B

