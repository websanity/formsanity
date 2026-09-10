<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Model;

/** A named group and the fields that carry its attribute, in document order. */
final readonly class Group
{
	/** @param list<string> $members */
	public function __construct(public string $kind, public string $name, public array $members)
	{
	}
}
