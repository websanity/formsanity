<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Model;

/** One `[data-fs-form]` element, read into the fields, regions, and groups a submission is judged against. */
final readonly class Form
{
	/**
	 * @param array<string, Field> $fields keyed by name, in document order
	 * @param list<Region> $regions
	 * @param list<Group> $groups
	 */
	public function __construct(
		public array $fields,
		public array $regions,
		public array $groups,
		public bool $hasFileInput,
	) {
	}
}
