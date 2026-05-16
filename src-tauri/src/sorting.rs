use std::{cmp::Ordering, fs, path::Path};

pub(crate) fn read_dir_sorted(path: &Path) -> Result<Vec<fs::DirEntry>, String> {
    let mut entries = fs::read_dir(path)
        .map_err(|error| format!("读取目录失败：{} ({error})", path.display()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取目录项失败：{} ({error})", path.display()))?;

    entries.sort_by(|left, right| {
        let left_name = left.file_name();
        let right_name = right.file_name();
        compare_windows_like_text(&left_name.to_string_lossy(), &right_name.to_string_lossy())
    });
    Ok(entries)
}

pub(crate) fn compare_paths_windows_like(left: &Path, right: &Path) -> Ordering {
    compare_windows_like_text(&left.to_string_lossy(), &right.to_string_lossy())
}

pub(crate) fn compare_windows_like_text(left: &str, right: &str) -> Ordering {
    let left_chars = left.chars().collect::<Vec<_>>();
    let right_chars = right.chars().collect::<Vec<_>>();
    let mut left_index = 0;
    let mut right_index = 0;

    while left_index < left_chars.len() && right_index < right_chars.len() {
        let left_char = left_chars[left_index];
        let right_char = right_chars[right_index];

        if left_char.is_ascii_digit() && right_char.is_ascii_digit() {
            let left_start = left_index;
            let right_start = right_index;

            while left_index < left_chars.len() && left_chars[left_index].is_ascii_digit() {
                left_index += 1;
            }

            while right_index < right_chars.len() && right_chars[right_index].is_ascii_digit() {
                right_index += 1;
            }

            let left_number = left_chars[left_start..left_index]
                .iter()
                .collect::<String>();
            let right_number = right_chars[right_start..right_index]
                .iter()
                .collect::<String>();
            let left_trimmed = left_number.trim_start_matches('0');
            let right_trimmed = right_number.trim_start_matches('0');
            let left_value = if left_trimmed.is_empty() {
                "0"
            } else {
                left_trimmed
            };
            let right_value = if right_trimmed.is_empty() {
                "0"
            } else {
                right_trimmed
            };

            match left_value.len().cmp(&right_value.len()) {
                Ordering::Equal => match left_value.cmp(right_value) {
                    Ordering::Equal => match left_number.len().cmp(&right_number.len()) {
                        Ordering::Equal => {}
                        order => return order,
                    },
                    order => return order,
                },
                order => return order,
            }

            continue;
        }

        let order = left_char
            .to_lowercase()
            .collect::<String>()
            .cmp(&right_char.to_lowercase().collect::<String>());

        if order != Ordering::Equal {
            return order;
        }

        left_index += 1;
        right_index += 1;
    }

    left_chars.len().cmp(&right_chars.len())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_like_sort_handles_parenthesized_numbers() {
        let mut names = vec![
            "1 (10).jpg",
            "1 (2).jpg",
            "1 (34).jpg",
            "1 (1).jpg",
            "1 (9).jpg",
        ];

        names.sort_by(|left, right| compare_windows_like_text(left, right));

        assert_eq!(
            names,
            vec![
                "1 (1).jpg",
                "1 (2).jpg",
                "1 (9).jpg",
                "1 (10).jpg",
                "1 (34).jpg"
            ]
        );
    }

    #[test]
    fn reverse_order_starts_from_largest_natural_number() {
        let mut names = vec!["10.jpg", "2.jpg", "99.jpg", "1.jpg"];

        names.sort_by(|left, right| compare_windows_like_text(left, right));
        names.reverse();

        assert_eq!(names, vec!["99.jpg", "10.jpg", "2.jpg", "1.jpg"]);
    }
}
